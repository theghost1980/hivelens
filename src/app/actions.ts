"use server";

import {
  countImagesInDateRange,
  getDistinctSyncedDates,
  getUniqueAvailableTags,
  SearchFiltersDb,
  searchImagesInDb,
} from "@/lib/database";
import { syncAndStoreHiveData, type SyncAndStoreResult } from "@/lib/hivesql"; // Importar SyncAndStoreResult
import type { HiveImage } from "@/lib/types";

export async function syncHiveData(
  startDate: string,
  endDate: string,
  options?: { confirmed?: boolean } // Añadir el parámetro options
): Promise<SyncAndStoreResult> {
  // Actualizar el tipo de retorno
  console.log("Action: syncHiveData called...");

  try {
    const startDateISO = startDate;
    const endDateISO = endDate;

    // Pasar el parámetro options a syncAndStoreHiveData
    const result = await syncAndStoreHiveData(
      startDateISO,
      endDateISO,
      options
    );
    return result;
  } catch (error) {
    console.error("Error in syncHiveData action:", error);
    return {
      status: "error", // Asegurar que el objeto de error coincida con SyncErrorResult
      message:
        error instanceof Error ? error.message : "Unknown error during sync",
      newImagesAdded: 0,
      existingImagesSkipped: 0,
      invalidOrInaccessibleImagesSkipped: 0,
      dbErrors: 1,
    };
  }
}

export async function searchLocalImages(
  filters: SearchFiltersDb,
  page: number,
  limit: number
): Promise<{ images: HiveImage[]; totalCount: number; currentPage: number }> {
  // Log para verificar que la acción se está llamando
  console.log("SERVER ACTION: searchLocalImages - INICIO");

  console.log(
    // Cambiado de console.debug a console.log para mayor visibilidad
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
      // Cambiado de console.debug a console.log
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
    return []; // Return empty array on error
  }
}
