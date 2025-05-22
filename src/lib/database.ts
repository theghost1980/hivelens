import path from "path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
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

    // Podríamos añadir índices aquí para mejorar el rendimiento de las búsquedas
    // Ejemplo: CREATE INDEX IF NOT EXISTS idx_image_url ON indexed_images (image_url);
    // Ejemplo: CREATE INDEX IF NOT EXISTS idx_hive_author ON indexed_images (hive_author);
    // Ejemplo: CREATE INDEX IF NOT EXISTS idx_ai_status ON indexed_images (ai_analysis_status);
    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_image_url ON indexed_images (image_url);"
    );
    await db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hive_author ON indexed_images (hive_author);"
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
  filters: SearchFiltersDb
): Promise<HiveImage[]> {
  const db = await getDb();
  let query = `
    SELECT 
      id, 
      image_url, 
      hive_author, 
      hive_permlink, 
      hive_post_url, 
      hive_title, 
      hive_timestamp, 
      hive_tags, 
      ai_content_type, 
      ai_features 
    FROM indexed_images
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filters.searchTerm) {
    query += `
      AND (
        hive_title LIKE ? OR 
        hive_tags LIKE ? OR 
        ai_content_type LIKE ? OR 
        ai_features LIKE ?
      )
    `;
    const searchTermLike = `%${filters.searchTerm.toLowerCase()}%`;
    params.push(searchTermLike, searchTermLike, searchTermLike, searchTermLike);
  }

  if (filters.author) {
    query += ` AND hive_author LIKE ?`;
    params.push(`%${filters.author.toLowerCase()}%`);
  }

  if (filters.dateFrom) {
    query += ` AND hive_timestamp >= ?`;
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    const nextDay = new Date(filters.dateTo);
    nextDay.setDate(nextDay.getDate() + 1);
    query += ` AND hive_timestamp < ?`;
    params.push(nextDay.toISOString().split("T")[0]);
  }

  query += ` ORDER BY hive_timestamp DESC`;

  const rawResults = await db.all<RawHiveDataRow>(query, params);

  if (!Array.isArray(rawResults)) {
    console.error(
      "searchImagesInDb: db.all no devolvió un array. Se obtuvo:",
      rawResults
    );
    return [];
  }

  return rawResults.map(
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
