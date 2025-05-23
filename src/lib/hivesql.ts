"use server";

/**
 * @fileOverview HiveSQL database connection and query utilities.
 *
 * - executeQuery - Executes a given SQL query against the HiveSQL database.
 * - testConnection - Tests the connection to HiveSQL with a simple query.
 */

import dotenv from "dotenv";
import sql from "mssql";
import {
  initializeDatabase,
  insertManyImages,
  type ImageRecord,
} from "./database"; // Importar utilidades de DB
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
  timestamp: Date; // Comes as Date from mssql driver
  title: string;
  permlink: string;
  json_metadata: string; // Raw JSON string
  postUrl: string;
}

function parseJsonMetadataForSync(metadataString: string): {
  image: string[]; // Always returns an array, potentially empty
  tags: string[]; // Always returns an array, potentially empty
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
    return { image: [], tags: [] }; // Return empty arrays on parse error
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

// --- Tipos de Resultado para syncAndStoreHiveData ---
export interface SyncSuccessResult {
  status: "success";
  images: HiveImage[];
  newImagesAdded: number;
  existingImagesSkipped: number;
  invalidOrInaccessibleImagesSkipped: number;
  dbErrors: number;
  message: string;
}

export interface SyncConfirmationRequiredResult {
  status: "confirmation_required";
  estimatedDays: number;
  estimatedTimePerDayMinutes: number; // El tiempo X que definirás
  totalEstimatedTimeMinutes: number;
  message: string;
}

export interface SyncErrorResult {
  status: "error";
  message: string;
  // Podríamos incluir contadores parciales si el error ocurre a mitad de camino
  newImagesAdded?: number;
  existingImagesSkipped?: number;
  invalidOrInaccessibleImagesSkipped?: number;
  dbErrors?: number;
}

export type SyncAndStoreResult =
  | SyncSuccessResult
  | SyncConfirmationRequiredResult
  | SyncErrorResult;

const ESTIMATED_TIME_PER_DAY_MINUTES = 40;

function calculateDaysBetween(
  isoDateStr1: string,
  isoDateStr2: string
): number {
  const date1 = new Date(isoDateStr1);
  const date2 = new Date(isoDateStr2);
  // La query es WHERE created >= startDate AND created < endDate
  // Por lo tanto, la diferencia directa en días es lo que necesitamos.
  const diffTime = date2.getTime() - date1.getTime(); // endDate es posterior
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays); // Asegurar al menos 1 día si el rango es muy corto o el mismo día
}

function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  if (totalMinutes < 0) return "0 minutos"; // Manejar caso negativo aunque no debería ocurrir
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
  const BATCH_SIZE = 100; // Configurable batch size

  try {
    // Paso de confirmación
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
    const overallSyncTimer = TimeUtils.start(); // Moved after DB init for more accurate sync timing
    const { results: rawPosts, time } =
      await executeQuery<HivePostCommentForSync>(query);
    console.log(
      `Fetched ${rawPosts.length} raw posts from HiveSQL in ${time}ms.`
    );

    let imageIdCounter = 0;

    for (const post of rawPosts) {
      if (!post.json_metadata) continue;

      const metadata = parseJsonMetadataForSync(post.json_metadata);
      // metadata.image and metadata.tags are now guaranteed to be arrays by parseJsonMetadataForSync
      const postImages = metadata.image;
      const postTags = metadata.tags;

      // Defensive check and logging for postImages type
      if (!Array.isArray(postImages)) {
        // This check should ideally no longer be needed but kept for safety
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
        // Attempt to count how many images might have been skipped and continue
        const potentialImageCount =
          typeof (postImages as any)?.length === "number"
            ? (postImages as any).length
            : 1;
        invalidOrInaccessibleImagesSkipped += potentialImageCount;
        continue; // Skip processing this post's images to prevent a crash
      }

      if (postImages.length === 0) continue;

      // Parallel validation of images for the current post
      const validationPromises = postImages.map((url) =>
        isValidImageUrl(url).then((isValid) => ({ url, isValid }))
      );

      // const validationTimer = TimeUtils.start(); // Optional: for per-post validation timing
      const validationResults = await Promise.allSettled(validationPromises);
      // const validationDuration = TimeUtils.calculate(validationTimer);
      // console.log(`Validated ${postImages.length} URLs for post @${post.author}/${post.permlink} in ${validationDuration.toFixed(2)}ms`);

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

        // Still prepare UI image data immediately for responsiveness if needed, or can be deferred
        // For now, let's keep uiImages populated as before for consistency in return
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
          recordsToInsert = []; // Reset for next batch
        } else {
          invalidOrInaccessibleImagesSkipped++;
          // if (result.status === 'rejected') {
          //   console.warn(`Validation promise rejected for URL ${result.reason?.config?.url || 'unknown'} in post @${post.author}/${post.permlink}: ${result.reason}`);
          // } else if (result.status === 'fulfilled' && !result.value.isValid) {
          //   // console.log(`URL not valid: ${result.value.url}`);
          // }
        }
      }
    }

    // Insert any remaining records that didn't make a full batch
    if (recordsToInsert.length > 0) {
      try {
        const batchResult = await insertManyImages(recordsToInsert);
        newImagesAddedToDb += batchResult.newImagesAdded;
        existingImagesSkipped +=
          recordsToInsert.length - batchResult.newImagesAdded;
      } catch (batchDbError) {
        console.error(`DB Error during final batch insert:`, batchDbError);
        dbErrors += recordsToInsert.length; // Or a single error, depending on how you want to count
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
    // If overallSyncTimer was initialized, log duration until error
    // Note: overallSyncTimer might not be initialized if initializeDatabase() fails first.
    // This simple check assumes it's more likely to fail during the main loop.
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Critical error during syncAndStoreHiveData: ${errorMessage}`,
      error
    );
    return {
      status: "error",
      message: `Error crítico durante la sincronización: ${errorMessage}`,
      // Devolver los contadores acumulados hasta el momento del error puede ser útil
      newImagesAdded: newImagesAddedToDb,
      existingImagesSkipped: existingImagesSkipped,
      invalidOrInaccessibleImagesSkipped,
      dbErrors,
    };
  }
}
