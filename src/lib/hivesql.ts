"use server";

/**
 * @fileOverview HiveSQL database connection and query utilities.
 *
 * - executeQuery - Executes a given SQL query against the HiveSQL database.
 * - testConnection - Tests the connection to HiveSQL with a simple query.
 */

import dotenv from "dotenv";
import sql from "mssql";
import { initializeDatabase, insertImage, type ImageRecord } from "./database"; // Importar utilidades de DB
import { TimeUtils } from "./time.utils";
import { HiveImage } from "./types";

// Fallback for loading .env if essential variables are not already set by the environment (e.g., Next.js)
// We check for one variable; if it's missing, we attempt to load .env
if (!process.env.HIVE_HOST) {
  dotenv.config({ path: ".env" });
}

const requiredEnvVars = [
  "HIVE_USER",
  "HIVE_PASSWORD",
  "HIVE_DATABASE",
  "HIVE_HOST",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  const errorMessage = `Missing required HiveSQL environment variables: ${missingEnvVars.join(
    ", "
  )}. Please ensure they are set in your .env file.`;
  console.error(errorMessage);
  throw new Error(errorMessage);
}

const sqlConfig: sql.config = {
  user: process.env.HIVE_USER!,
  password: process.env.HIVE_PASSWORD!,
  database: process.env.HIVE_DATABASE!,
  server: process.env.HIVE_HOST!,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    trustServerCertificate: true, // Recommended to set to false for production with valid certs
    encrypt: true, // For Azure SQL or if your SQL Server requires encryption
  },
  requestTimeout: 120000, // 2 minutes
};

/**
 * Executes a SQL query and returns the results along with execution time.
 * @param query The SQL query string to execute.
 * @returns A promise that resolves to an object containing results and execution time.
 * @template T The expected type of the items in the results array.
 */
export async function executeQuery<T = any>(
  query: string
): Promise<{
  results: T[];
  time: number;
}> {
  try {
    const pool = await sql.connect(sqlConfig);
    const start = TimeUtils.start();
    const result = await pool.request().query<T>(query);
    const timeExecutionQuery = TimeUtils.calculate(start);
    console.log(
      `Executed query in ${timeExecutionQuery.toFixed(2)} ms. Rows: ${
        result.recordset.length
      }`
    );
    return { results: result.recordset, time: timeExecutionQuery };
  } catch (error) {
    console.error(
      "Error executing HiveSQL query:",
      error instanceof Error ? error.message : error
    );
    if (error instanceof sql.RequestError) {
      console.error("SQL RequestError Details:", {
        code: error.code,
        lineNumber: error.lineNumber,
        state: error.state,
        class: error.class,
        serverName: error.serverName,
        procName: error.procName,
      });
    }
    throw new Error(
      `Failed to execute HiveSQL query. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Tests the connection to the HiveSQL database by fetching the top 1 account.
 * @returns A promise that resolves to an object with results and execution time, or null on error.
 */
export const testConnection = async (): Promise<{
  results: any[];
  time_ms: number;
} | null> => {
  try {
    const simpleQuery = "SELECT TOP 1 name, created FROM Accounts;";
    const { results, time } = await executeQuery(simpleQuery);
    return { time_ms: time, results: results };
  } catch (err) {
    return null;
  }
};
interface HivePostCommentForSync {
  author: string;
  timestamp: Date;
  title: string;
  permlink: string;
  json_metadata: string;
  postUrl: string;
}

function parseJsonMetadataForSync(metadataString: string): {
  image?: string[];
  tags?: string[];
  [key: string]: any;
} {
  if (!metadataString) return {};
  try {
    const parsed = JSON.parse(metadataString);
    return {
      image: Array.isArray(parsed.image)
        ? parsed.image.filter(
            (img: any): img is string =>
              typeof img === "string" && img.startsWith("http")
          )
        : typeof parsed.image === "string" && parsed.image.startsWith("http")
        ? [parsed.image]
        : [],
      tags: Array.isArray(parsed.tags)
        ? [
            ...new Set(
              parsed.tags.filter((tag: any) => typeof tag === "string")
            ),
          ]
        : [],
      ...parsed,
    };
  } catch (e) {
    return {};
  }
}

/**
 * Checks if an image URL is valid and accessible by making a HEAD request.
 * @param url The URL of the image to check.
 * @returns True if the image is accessible (status 200-299), false otherwise.
 */
async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    }); // 5-second timeout
    return response.ok;
  } catch (error) {
    console.warn(
      `[ImageValidation] Failed for URL ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return false;
  }
}
export async function syncAndStoreHiveData(
  startDateISO: string,
  endDateISO: string
): Promise<{
  images: HiveImage[];
  newImagesAdded: number;
  existingImagesSkipped: number;
  invalidOrInaccessibleImagesSkipped: number;
  dbErrors: number;
}> {
  console.log(
    `Starting Hive data sync & store from ${startDateISO} to ${endDateISO}...`
  );

  const query = `
    SELECT
        author,
        created AS timestamp,
        title,
        permlink,
        json_metadata,
        CONCAT('https://peakd.com/@', author, '/', permlink) as postUrl 
    FROM Comments
    WHERE
        depth = 0 
        AND created >= '${startDateISO}' AND created < '${endDateISO}'
        AND (json_metadata LIKE '%"image":%' OR json_metadata LIKE '%"images":%')
    ORDER BY created DESC;
  `;

  let newImagesAddedToDb = 0;
  let existingImagesSkipped = 0;
  let dbErrors = 0;
  let invalidOrInaccessibleImagesSkipped = 0;
  const uiImages: HiveImage[] = [];

  try {
    await initializeDatabase();
    const { results: rawPosts, time } =
      await executeQuery<HivePostCommentForSync>(query);
    console.log(
      `Fetched ${rawPosts.length} raw posts from HiveSQL in ${time}ms.`
    );

    let imageIdCounter = 0;

    for (const post of rawPosts) {
      if (!post.json_metadata) continue;

      const metadata = parseJsonMetadataForSync(post.json_metadata);
      const postImages = metadata.image || [];
      const postTags = metadata.tags || [];

      if (postImages.length === 0) continue;

      for (const imageUrl of postImages) {
        if (!imageUrl || !imageUrl.startsWith("http")) continue;

        if (!(await isValidImageUrl(imageUrl))) {
          console.log(
            `[SyncProcess] Skipping invalid/inaccessible image URL: ${imageUrl}`
          );
          invalidOrInaccessibleImagesSkipped++;
          continue;
        }

        const dbRecord: ImageRecord = {
          image_url: imageUrl,
          hive_author: post.author,
          hive_permlink: post.permlink,
          hive_post_url: post.postUrl,
          hive_title: post.title,
          hive_timestamp: post.timestamp.toISOString(),
          hive_tags: JSON.stringify(postTags),
        };

        try {
          const insertResult = await insertImage(dbRecord);
          if (insertResult.new) newImagesAddedToDb++;
          else existingImagesSkipped++;

          imageIdCounter++;
          const uiImage: HiveImage = {
            id: `img-${post.author}-${post.permlink}-${imageIdCounter}`,
            imageUrl: imageUrl,
            author: post.author,
            timestamp: post.timestamp.toISOString(),
            title: post.title || `Image from ${post.author}`,
            postUrl: post.postUrl,
            tags: postTags,
          };
          uiImages.push(uiImage);
        } catch (dbError) {
          console.error(`DB Error for ${imageUrl}:`, dbError);
          dbErrors++;
        }
      }
    }

    console.log(`Sync & Store finished. Processed ${rawPosts.length} posts.`);
    console.log(
      `DB: ${newImagesAddedToDb} new added, ${existingImagesSkipped} existing skipped, ${invalidOrInaccessibleImagesSkipped} invalid/inaccessible skipped, ${dbErrors} DB errors.`
    );

    return {
      images: uiImages.slice(0, 200),
      newImagesAdded: newImagesAddedToDb,
      existingImagesSkipped: existingImagesSkipped,
      invalidOrInaccessibleImagesSkipped,
      dbErrors,
    };
  } catch (error) {
    console.error("Error during syncAndStoreHiveData:", error);
    return {
      images: [],
      newImagesAdded: newImagesAddedToDb,
      existingImagesSkipped: existingImagesSkipped,
      invalidOrInaccessibleImagesSkipped,
      dbErrors: dbErrors + 1,
    };
  }
}
