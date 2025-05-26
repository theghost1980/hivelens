"use server";

import {
  countImagesInDateRange,
  getDatabaseSizeMB,
  getDistinctSyncedDates,
  getUniqueAvailableTags,
  searchImagesInDb,
} from "@/lib/database";
import { getSyncStatus, syncAndStoreHiveData } from "@/lib/hivesql";
import {
  HiveImage,
  SearchFiltersDb,
  SyncAndStoreResult,
  SyncInProgressError, // Importar desde types.ts
} from "@/lib/types";

export async function syncHiveData(
  startDate: string,
  endDate: string,
  options?: { confirmed?: boolean; initiatorUsername?: string } // Añadir initiatorUsername a las opciones
): Promise<SyncAndStoreResult> {
  console.log(
    `Action: syncHiveData called with options: ${JSON.stringify(options)}`
  );
  try {
    const startDateISO = startDate;
    const endDateISO = endDate;
    const result = await syncAndStoreHiveData(
      startDateISO,
      endDateISO,
      options // Pasar todas las opciones, incluyendo initiatorUsername
    );
    return result;
  } catch (error) {
    if (error instanceof SyncInProgressError) {
      const dbSize = getDatabaseSizeMB();
      const statusDetails = await getSyncStatus(); // Añadir await
      console.warn(
        "Action: Sync already in progress - ",
        statusDetails?.message
      );
      return {
        currentDbSizeMB: dbSize ?? undefined,
        status: "sync_in_progress",
        message: "La sincronización ya está en progreso.", // Mensaje principal
        details: statusDetails?.message, // Mensaje detallado para el usuario
        syncStatus: statusDetails, // Objeto de estado completo
      };
    }
    console.error("Error in syncHiveData action:", error);
    const dbSize = getDatabaseSizeMB();
    return {
      currentDbSizeMB: dbSize ?? undefined,
      status: "error",
      message:
        error instanceof Error ? error.message : "Unknown error during sync",
      // Para errores genéricos, los contadores de imágenes usualmente serían 0
      dbErrors: 0, // Si el error es antes de la interacción con DB, dbErrors debería ser 0
    };
  }
}

export async function searchLocalImages(
  filters: SearchFiltersDb,
  page: number,
  limit: number
): Promise<{ images: HiveImage[]; totalCount: number; currentPage: number }> {
  console.log("SERVER ACTION: searchLocalImages - INICIO");
  console.log(
    `Action: searchLocalImages called with filters: ${JSON.stringify(
      filters
    )}, page: ${page}, limit: ${limit}`
  );
  try {
    const offset = (page - 1) * limit;
    if (page < 1 || limit < 1) {
      throw new Error("Page and limit must be positive integers.");
    }
    const { images: foundImages, totalCount } = await searchImagesInDb(
      filters,
      limit,
      offset
    );
    console.log(
      `Found ${foundImages.length} images for page ${page} (total: ${totalCount}) in local DB.`
    );
    return { images: foundImages, totalCount, currentPage: page };
  } catch (error) {
    console.error("Error in searchLocalImages action:", error);
    return { images: [], totalCount: 0, currentPage: page };
  }
}

export async function checkIfDateRangeHasData(
  startDateISO: string,
  endDateISO: string
): Promise<boolean> {
  console.log(
    "Action: checkIfDateRangeHasData called with dates:",
    startDateISO,
    endDateISO
  );
  if (!startDateISO || !endDateISO) {
    return false;
  }
  try {
    const count = await countImagesInDateRange(startDateISO, endDateISO);
    return count > 0;
  } catch (error) {
    console.error("Error in checkIfDateRangeHasData action:", error);
    return false;
  }
}

export async function fetchDistinctSyncedDates(): Promise<string[]> {
  try {
    const dates = await getDistinctSyncedDates();
    return dates;
  } catch (error) {
    console.error("Error fetching distinct synced dates:", error);
    return [];
  }
}

export async function fetchAllUniqueTags(): Promise<string[]> {
  console.log("Action: fetchAllUniqueTags called...");
  try {
    const tags = await getUniqueAvailableTags();
    return tags;
  } catch (error) {
    console.error("Error in fetchAllUniqueTags action:", error);
    return [];
  }
}
