"use server";
/**
 * @fileOverview HiveSQL database connection and query utilities.
 *
 * - executeQuery - Executes a given SQL query against the HiveSQL database.
 * - testConnection - Tests the connection to HiveSQL with a simple query.
 */
import dotenv from "dotenv";
import fs from "fs";
import sql from "mssql";
import { DB_FILE_PATH, initializeDatabase, insertManyImages } from "./database";
import { TimeUtils } from "./time.utils";
import {
  HiveImage,
  HivePostCommentForSync,
  ImageRecord,
  SyncAndStoreResult,
} from "./types";
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
    trustServerCertificate: true,
    encrypt: true,
  },
  requestTimeout: 120000,
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

function parseJsonMetadataForSync(metadataString: string): {
  image: string[];
  tags: string[];
  [key: string]: any;
} {
  if (!metadataString) return { image: [], tags: [] };
  try {
    const parsed = JSON.parse(metadataString);
    let images: string[] = [];
    if (Array.isArray(parsed.image)) {
      images = parsed.image.filter(
        (img: any): img is string =>
          typeof img === "string" && img.startsWith("http")
      );
    } else if (
      typeof parsed.image === "string" &&
      parsed.image.startsWith("http")
    ) {
      images = [parsed.image];
    }

    return {
      image: images,
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
    return { image: [], tags: [] };
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
    });
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

const ESTIMATED_TIME_PER_DAY_MINUTES = 40;
const MAX_DB_SIZE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const MAX_DB_SIZE_MB = MAX_DB_SIZE_BYTES / (1024 * 1024);
const QUOTA_EXCEEDED_MESSAGE =
  "Please contact admin of the index @theghost1980 in HIVE or discord as the DB has reached maximum allowed quota!";

function calculateDaysBetween(
  isoDateStr1: string,
  isoDateStr2: string
): number {
  const date1 = new Date(isoDateStr1);
  const date2 = new Date(isoDateStr2);
  const diffTime = date2.getTime() - date1.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  if (totalMinutes < 0) return "0 minutos";
  if (totalMinutes < 60) {
    return `${totalMinutes} minuto${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let formattedString = `${hours} hora${hours > 1 ? "s" : ""}`;
  if (minutes > 0) {
    formattedString += `, ${minutes} minuto${minutes > 1 ? "s" : ""}`;
  }
  return formattedString;
}

export async function syncAndStoreHiveData(
  startDateISO: string,
  endDateISO: string,
  options?: { confirmed?: boolean }
): Promise<SyncAndStoreResult> {
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
  let recordsToInsert: ImageRecord[] = [];
  const BATCH_SIZE = 100;

  try {
    // Verificar el tamaño de la base de datos antes de cualquier otra cosa
    if (fs.existsSync(DB_FILE_PATH)) {
      const stats = fs.statSync(DB_FILE_PATH);
      const currentDbSizeBytes = stats.size;
      const currentDbSizeMB = currentDbSizeBytes / (1024 * 1024);

      if (currentDbSizeBytes > MAX_DB_SIZE_BYTES) {
        console.warn(
          `DB size quota exceeded: ${currentDbSizeMB.toFixed(
            2
          )}MB / ${MAX_DB_SIZE_MB}MB`
        );
        return {
          status: "quota_exceeded",
          message: QUOTA_EXCEEDED_MESSAGE,
          currentDbSizeMB: parseFloat(currentDbSizeMB.toFixed(2)),
          maxDbSizeMB: MAX_DB_SIZE_MB,
        };
      }
    }
    if (!options?.confirmed) {
      const estimatedDays = calculateDaysBetween(startDateISO, endDateISO);
      const totalEstimatedTimeMinutes =
        estimatedDays * ESTIMATED_TIME_PER_DAY_MINUTES;
      const formattedTotalTime = formatMinutesToHoursAndMinutes(
        totalEstimatedTimeMinutes
      );
      const message =
        `Últimas pruebas: 1 día aprox. ${ESTIMATED_TIME_PER_DAY_MINUTES} minutos.\n\n` +
        `Total del rango deseado: ${estimatedDays} día(s) (${startDateISO} a ${endDateISO}) tomará aprox. ${totalEstimatedTimeMinutes} minutos (${formattedTotalTime}).\n\n` +
        `¿Deseas continuar?`;

      console.log(`[CONFIRMATION_REQUIRED] ${message}`);
      return {
        status: "confirmation_required",
        estimatedDays,
        estimatedTimePerDayMinutes: ESTIMATED_TIME_PER_DAY_MINUTES,
        totalEstimatedTimeMinutes,
        message,
      };
    }

    console.log("Confirmación recibida, procediendo con la sincronización...");
    await initializeDatabase();
    const overallSyncTimer = TimeUtils.start();
    const { results: rawPosts, time } =
      await executeQuery<HivePostCommentForSync>(query);
    console.log(
      `Fetched ${rawPosts.length} raw posts from HiveSQL in ${time}ms.`
    );

    let imageIdCounter = 0;

    for (const post of rawPosts) {
      if (!post.json_metadata) continue;

      const metadata = parseJsonMetadataForSync(post.json_metadata);
      const postImages = metadata.image;
      const postTags = metadata.tags;

      if (!Array.isArray(postImages)) {
        console.error(
          `CRITICAL TYPE ERROR: postImages is not an array before .map call. Type: ${typeof postImages}, Value: ${JSON.stringify(
            postImages
          )}`
        );
        console.error(
          `  Post Author: ${post.author}, Permlink: ${post.permlink}`
        );
        console.error(
          `  metadata.image was: ${JSON.stringify(metadata.image)}`
        );
        console.error(
          `  Original post.json_metadata (first 500 chars): ${String(
            post.json_metadata
          ).substring(0, 500)}...`
        );
        const potentialImageCount =
          typeof (postImages as any)?.length === "number"
            ? (postImages as any).length
            : 1;
        invalidOrInaccessibleImagesSkipped += potentialImageCount;
        continue;
      }

      if (postImages.length === 0) continue;

      const validationPromises = postImages.map((url) =>
        isValidImageUrl(url).then((isValid) => ({ url, isValid }))
      );
      const validationResults = await Promise.allSettled(validationPromises);

      for (const result of validationResults) {
        if (result.status !== "fulfilled" || !result.value.isValid) {
          invalidOrInaccessibleImagesSkipped++;
          continue;
        }
        const imageUrl = result.value.url;
        recordsToInsert.push({
          image_url: imageUrl,
          hive_author: post.author,
          hive_permlink: post.permlink,
          hive_post_url: post.postUrl,
          hive_title: post.title,
          hive_timestamp: post.timestamp.toISOString(),
          hive_tags: JSON.stringify(postTags),
        });

        imageIdCounter++;
        uiImages.push({
          id: `img-${post.author}-${post.permlink}-${imageIdCounter}`,
          imageUrl: imageUrl,
          author: post.author,
          timestamp: post.timestamp.toISOString(),
          title: post.title || `Image from ${post.author}`,
          postUrl: post.postUrl,
          tags: postTags,
        });

        if (recordsToInsert.length >= BATCH_SIZE) {
          const batchResult = await insertManyImages(recordsToInsert);
          newImagesAddedToDb += batchResult.newImagesAdded;
          existingImagesSkipped +=
            recordsToInsert.length - batchResult.newImagesAdded;
          recordsToInsert = [];
        } else {
          invalidOrInaccessibleImagesSkipped++;
        }
      }
    }

    if (recordsToInsert.length > 0) {
      try {
        const batchResult = await insertManyImages(recordsToInsert);
        newImagesAddedToDb += batchResult.newImagesAdded;
        existingImagesSkipped +=
          recordsToInsert.length - batchResult.newImagesAdded;
      } catch (batchDbError) {
        console.error(`DB Error during final batch insert:`, batchDbError);
        dbErrors += recordsToInsert.length;
      }
    }

    console.log(`Sync & Store finished. Processed ${rawPosts.length} posts.`);
    console.log(
      `DB: ${newImagesAddedToDb} new added, ${existingImagesSkipped} existing skipped, ${invalidOrInaccessibleImagesSkipped} invalid/inaccessible skipped, ${dbErrors} DB errors.`
    );
    const totalSyncDuration = TimeUtils.calculate(overallSyncTimer);
    console.log(
      `Total sync and store process completed in ${totalSyncDuration.toFixed(
        2
      )}ms.`
    );

    return {
      status: "success",
      images: uiImages.slice(0, 200),
      newImagesAdded: newImagesAddedToDb,
      existingImagesSkipped: existingImagesSkipped,
      invalidOrInaccessibleImagesSkipped,
      dbErrors,
      message: `Sincronización completada. ${newImagesAddedToDb} imágenes nuevas añadidas.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Critical error during syncAndStoreHiveData: ${errorMessage}`,
      error
    );
    return {
      status: "error",
      message: `Error crítico durante la sincronización: ${errorMessage}`,
      newImagesAdded: newImagesAddedToDb,
      existingImagesSkipped: existingImagesSkipped,
      invalidOrInaccessibleImagesSkipped,
      dbErrors,
    };
  }
}
