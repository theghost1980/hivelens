"use server";

import {
  countImagesInDateRange,
  getDistinctSyncedDates,
  SearchFiltersDb,
  searchImagesInDb,
} from "@/lib/database";
import { syncAndStoreHiveData } from "@/lib/hivesql";
import type { HiveImage } from "@/lib/types";

export async function syncHiveData(
  startDate: string,
  endDate: string
): Promise<{
  images: HiveImage[];
  newImagesAdded: number;
  existingImagesSkipped: number;
  invalidOrInaccessibleImagesSkipped: number;
  dbErrors: number;
  message?: string;
}> {
  console.log("Action: syncHiveData called...");

  try {
    const startDateISO = startDate;
    const endDateISO = endDate;

    const result = await syncAndStoreHiveData(startDateISO, endDateISO);
    return result;
  } catch (error) {
    console.error("Error in syncHiveData action:", error);
    return {
      images: [],
      newImagesAdded: 0,
      existingImagesSkipped: 0,
      invalidOrInaccessibleImagesSkipped: 0,
      dbErrors: 1,
    };
  }
}

export async function searchLocalImages(
  filters: SearchFiltersDb
): Promise<HiveImage[]> {
  console.log("Action: searchLocalImages called with filters:", filters);
  try {
    const images = await searchImagesInDb(filters);
    console.log(`Found ${images.length} images in local DB.`);
    return images;
  } catch (error) {
    console.error("Error in searchLocalImages action:", error);
    return [];
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
