import path from "path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import { TimeUtils } from "./time.utils";
import type { HiveImage } from "./types";

const DB_FILE_PATH = path.join(process.cwd(), "hivelens.db");

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const db = await open({
      filename: DB_FILE_PATH,
      driver: sqlite3.Database,
    });

    console.log("Connected to the SQLite database.");
    dbInstance = db;
    return db;
  } catch (error) {
    console.error("Error connecting to SQLite database:", error);
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS indexed_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT UNIQUE NOT NULL,
      hive_author TEXT,
      hive_permlink TEXT,
      hive_post_url TEXT,
      hive_title TEXT,
      hive_timestamp TEXT,
      hive_tags TEXT,
      ai_analysis_status TEXT DEFAULT 'pending',
      ai_content_type TEXT,
      ai_features TEXT,
      indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_ai_attempt_at TEXT
    );
  `;

  try {
    await db.exec(createTableQuery);
    console.log('Table "indexed_images" is ready.');

    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_image_url ON indexed_images (image_url);"
    );
    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hive_author ON indexed_images (hive_author);"
    );
    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hive_title ON indexed_images (LOWER(hive_title));"
    );
    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hive_tags ON indexed_images (LOWER(hive_tags));"
    );
    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_ai_status ON indexed_images (ai_analysis_status);"
    );
    console.log('Indexes for "indexed_images" created or already exist.');
  } catch (error) {
    console.error("Error initializing database table:", error);
    throw error;
  }
}

export interface ImageRecord {
  image_url: string;
  hive_author?: string;
  hive_permlink?: string;
  hive_post_url?: string;
  hive_title?: string;
  hive_timestamp?: string;
  hive_tags?: string;
}

export async function insertImage(
  image: ImageRecord
): Promise<{ id: number | undefined; new: boolean }> {
  const {
    image_url,
    hive_author,
    hive_permlink,
    hive_post_url,
    hive_title,
    hive_timestamp,
    hive_tags,
  } = image;

  try {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO indexed_images (image_url, hive_author, hive_permlink, hive_post_url, hive_title, hive_timestamp, hive_tags, ai_analysis_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        image_url,
        hive_author,
        hive_permlink,
        hive_post_url,
        hive_title,
        hive_timestamp,
        hive_tags,
      ]
    );
    return { id: result.lastID, new: true };
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { id: undefined, new: false };
    }
    console.error("Error inserting image:", image_url, error);
    throw error;
  }
}

export interface SearchFiltersDb {
  searchTerm?: string;
  author?: string;
  title?: string;
  tags?: string; // Expecting comma-separated tags or a single tag
  dateFrom?: string;
  dateTo?: string;
}
interface RawHiveDataRow {
  id: number;
  image_url: string;
  hive_author: string;
  hive_permlink: string;
  hive_post_url: string;
  hive_title: string;
  hive_timestamp: string;
  hive_tags: string | null;
  ai_content_type: string | null;
  ai_features: string | null;
}

export async function searchImagesInDb(
  filters: SearchFiltersDb,
  limit: number,
  offset: number
): Promise<{ images: HiveImage[]; totalCount: number }> {
  const searchStartTime = TimeUtils.start();
  const db = await getDb();
  let baseQuery = `FROM indexed_images WHERE 1=1`;
  let selectClause = `SELECT 
      id, 
      image_url, 
      hive_author, 
      hive_permlink, 
      hive_post_url, 
      hive_title, 
      hive_timestamp, 
      hive_tags, 
      ai_content_type, 
      ai_features `;

  const params: (string | number)[] = [];
  let whereConditions = "";

  if (filters.searchTerm?.trim()) {
    whereConditions += `
      AND (LOWER(hive_title) LIKE ? OR 
        LOWER(hive_tags) LIKE ? OR 
        LOWER(ai_content_type) LIKE ? OR 
        LOWER(ai_features) LIKE ?)
      )
    `;
    const searchTermLike = `%${filters.searchTerm.toLowerCase()}%`;
    params.push(searchTermLike, searchTermLike, searchTermLike, searchTermLike); // 4 params for 4 LIKEs
  }

  if (filters.title?.trim()) {
    whereConditions += ` AND LOWER(hive_title) LIKE ?`;
    params.push(`%${filters.title.toLowerCase()}%`);
  }

  if (filters.tags?.trim()) {
    const tagsToSearch = filters.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);
    if (tagsToSearch.length > 0) {
      tagsToSearch.forEach((tag) => {
        whereConditions += ` AND LOWER(hive_tags) LIKE ?`;
        params.push(`%${tag}%`);
      });
    }
  }

  if (filters.author?.trim()) {
    whereConditions += ` AND LOWER(hive_author) LIKE ?`;
    params.push(`%${filters.author.toLowerCase()}%`);
  }

  if (filters.dateFrom) {
    whereConditions += ` AND hive_timestamp >= ?`;
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    const nextDay = new Date(filters.dateTo);
    nextDay.setDate(nextDay.getDate() + 1);
    whereConditions += ` AND hive_timestamp < ?`;
    params.push(nextDay.toISOString().split("T")[0]);
  }

  const countQuery = `SELECT COUNT(*) as count ${baseQuery} ${whereConditions}`;
  const countResult = await db.get<{ count: number }>(countQuery, params);
  const totalCount = countResult?.count || 0;

  if (totalCount === 0) {
    return { images: [], totalCount: 0 };
  }

  const dataQuery = `${selectClause} ${baseQuery} ${whereConditions} ORDER BY hive_timestamp DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, limit, offset];
  const rawResults = await db.all<RawHiveDataRow>(dataQuery, dataParams);

  if (!Array.isArray(rawResults)) {
    console.error(
      "searchImagesInDb: db.all no devolvió un array. Se obtuvo:",
      rawResults
    );
    return { images: [], totalCount: 0 };
  }

  const searchExecutionTime = TimeUtils.calculate(searchStartTime);
  console.log(
    `[DB Search] Filters: ${JSON.stringify(filters)}, Page: ${
      offset / limit + 1
    }, Limit: ${limit}. Found ${totalCount} total results. Query time: ${searchExecutionTime.toFixed(
      2
    )} ms.`
  );

  const images = rawResults.map(
    (row: RawHiveDataRow): HiveImage => ({
      id: String(row.id),
      imageUrl: row.image_url,
      author: row.hive_author,
      timestamp: row.hive_timestamp,
      title: row.hive_title,
      postUrl: row.hive_post_url,
      tags: row.hive_tags ? JSON.parse(row.hive_tags) : [],
      aiAnalysis: {
        contentType: row.ai_content_type || "Unknown",
        features: row.ai_features ? JSON.parse(row.ai_features) : [],
      },
    })
  );

  return { images, totalCount };
}

/**
 * Counts the number of images in the local database within a given date range.
 * @param dateFrom ISO string 'YYYY-MM-DD'
 * @param dateTo ISO string 'YYYY-MM-DD'
 * @returns Promise resolving to the count of images.
 */
export async function countImagesInDateRange(
  dateFrom: string,
  dateTo: string
): Promise<number> {
  const db = await getDb();
  let query = `SELECT COUNT(*) as count FROM indexed_images WHERE 1=1`;
  const params: string[] = [];

  if (dateFrom) {
    query += ` AND hive_timestamp >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    const nextDay = new Date(dateTo);
    nextDay.setDate(nextDay.getDate() + 1);
    query += ` AND hive_timestamp < ?`;
    params.push(nextDay.toISOString().split("T")[0]);
  }
  const result = await db.get<{ count: number }>(query, params);
  return result?.count || 0;
}

/**
 * Retrieves a list of distinct dates (YYYY-MM-DD) that have indexed images.
 */
export async function getDistinctSyncedDates(): Promise<string[]> {
  const db = await getDb();
  const query = `SELECT DISTINCT SUBSTR(hive_timestamp, 1, 10) as sync_date FROM indexed_images ORDER BY sync_date DESC`;
  const results = await db.all<{ sync_date: string }[]>(query);
  return results.map((row) => row.sync_date);
}
