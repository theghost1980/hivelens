import fs from "fs";
import path from "path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import { TimeUtils } from "./time.utils";
import type {
  HiveImage,
  ImageRecord,
  RawHiveDataRow,
  SearchFiltersDb,
} from "./types";

const DB_FILE_PATH = path.join(
  process.cwd(),
  "..",
  "BD-central",
  "hivelens.db"
);

export { DB_FILE_PATH };

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const dbDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dbDir)) {
      const errorMessage = `Error Crítico: El directorio de la base de datos '${dbDir}' no existe. Este directorio es necesario y debe contener el archivo 'hivelens.db'. Por favor, cree manualmente el directorio '${path.basename(
        dbDir
      )}' en la ubicación: '${path.dirname(dbDir)}'.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const db = await open({
      filename: DB_FILE_PATH,
      driver: sqlite3.Database,
    });

    console.log(
      `Conexión exitosa con la base de datos SQLite en: ${DB_FILE_PATH}`
    );
    dbInstance = db;
    return db;
  } catch (error) {
    console.error("Error connecting to SQLite database:", error);
    throw error;
  }
}

/**
 * Gets the current size of the database file in megabytes.
 * @returns The size of the database in MB, or null if the file doesn't exist.
 */
export function getDatabaseSizeMB(): number | null {
  if (fs.existsSync(DB_FILE_PATH)) {
    const stats = fs.statSync(DB_FILE_PATH);
    return parseFloat((stats.size / (1024 * 1024)).toFixed(2));
  }
  console.warn("[DB] DB_FILE_PATH not found when trying to get database size.");
  return null;
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

/**
 * Inserts multiple image records into the database in a single batch.
 * Uses 'INSERT OR IGNORE' to skip duplicates based on the UNIQUE constraint on image_url.
 * @param images An array of ImageRecord objects to insert.
 * @returns A promise resolving to an object containing the number of new images actually added.
 */
export async function insertManyImages(
  images: ImageRecord[]
): Promise<{ newImagesAdded: number }> {
  if (!images || images.length === 0) {
    return { newImagesAdded: 0 };
  }

  const db = await getDb();
  const placeholders = images
    .map(() => "(?, ?, ?, ?, ?, ?, ?, 'pending')")
    .join(", ");
  const query = `
    INSERT OR IGNORE INTO indexed_images 
    (image_url, hive_author, hive_permlink, hive_post_url, hive_title, hive_timestamp, hive_tags, ai_analysis_status) 
    VALUES ${placeholders}
  `;

  const values: any[] = [];
  for (const image of images) {
    values.push(
      image.image_url,
      image.hive_author,
      image.hive_permlink,
      image.hive_post_url,
      image.hive_title,
      image.hive_timestamp,
      image.hive_tags
    );
  }

  try {
    const result = await db.run(query, values);
    return { newImagesAdded: result.changes ?? 0 };
  } catch (error: any) {
    console.error("Error inserting multiple images:", error);
    throw error;
  }
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
    const searchTermLike = `%${filters.searchTerm.toLowerCase()}%`;
    whereConditions += ` AND (LOWER(hive_title) LIKE ? OR LOWER(hive_tags) LIKE ? OR LOWER(ai_content_type) LIKE ? OR LOWER(ai_features) LIKE ?)`;
    params.push(searchTermLike, searchTermLike, searchTermLike, searchTermLike);
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
        whereConditions += ` AND EXISTS (SELECT 1 FROM json_each(indexed_images.hive_tags) WHERE LOWER(value) = ?)`;
        params.push(tag);
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

/**
 * Fetches a list of all unique tags from the indexed_images table.
 * Tags are extracted from the JSON array in the hive_tags column.
 * @returns A promise resolving to an array of unique tag strings, sorted alphabetically.
 */
export async function getUniqueAvailableTags(): Promise<string[]> {
  const db = await getDb();
  try {
    const rows = await db.all<{ value: string }[]>(`
      SELECT DISTINCT value
      FROM indexed_images, json_each(indexed_images.hive_tags)
      ORDER BY value ASC;
    `);
    return rows.map((row) => row.value);
  } catch (error) {
    console.error("Error fetching unique available tags:", error);
    return [];
  }
}
