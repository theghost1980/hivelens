"use client";

import { ImageResultsGrid } from "@/components/image-results-grid";
import { AppHeader } from "@/components/layout/app-header";
import {
  SearchControls,
  type SearchFilters,
} from "@/components/search-controls";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logAllDetectedHostnames } from "@/lib/image-config";
import type { HiveImage } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { DownloadCloud, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkIfDateRangeHasData,
  fetchDistinctSyncedDates,
  searchLocalImages,
  syncHiveData,
} from "./actions";

export default function HomePage() {
  const [allImages, setAllImages] = useState<HiveImage[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: "",
    author: "",
    dateRange: undefined,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [syncedDays, setSyncedDays] = useState<Date[]>([]);
  const { toast } = useToast();

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (!filters.dateRange?.from || !filters.dateRange?.to) {
        toast({
          title: "Date Range Required",
          description: "Please select a start and end date to sync.",
          variant: "destructive",
        });
        setIsSyncing(false);
        return;
      }

      const startDateStr = format(filters.dateRange.from, "yyyy-MM-dd");
      const endDateStr = format(filters.dateRange.to, "yyyy-MM-dd");

      const hasData = await checkIfDateRangeHasData(startDateStr, endDateStr);
      if (hasData) {
        const userConfirmed = window.confirm(
          "Data for this date range already exists in the local DB. Do you want to sync again to fetch potential new entries or updates?"
        );
        if (!userConfirmed) {
          setIsSyncing(false);
          toast({
            title: "Sync Cancelled",
            description: "Synchronization was cancelled by the user.",
          });
          return;
        }
      }

      const syncResult = await syncHiveData(startDateStr, endDateStr);

      setAllImages(syncResult.images);

      let description = `Found ${syncResult.images.length} images in this batch (display limited).`;
      description += `\nDB: ${syncResult.newImagesAdded} new, ${syncResult.existingImagesSkipped} duplicates skipped.`;
      description += `\n${syncResult.invalidOrInaccessibleImagesSkipped} invalid/broken URLs skipped.`;
      if (syncResult.dbErrors > 0)
        description += `\n${syncResult.dbErrors} DB errors.`;
      toast({
        description: `Fetched ${syncResult.images.length} images from Hive.`,
      });
    } catch (error) {
      console.error("Error syncing data:", error);
      toast({
        title: "Sync Error",
        description: "Could not fetch images from Hive. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setHasAttemptedLoad(true);
    }
  }, [toast, filters.dateRange]);

  const handleSearch = useCallback(async (newFilters: SearchFilters) => {
    setIsSearching(true);
    const dbFilters = {
      searchTerm: newFilters.searchTerm,
      author: newFilters.author,
      dateFrom: newFilters.dateRange?.from
        ? format(newFilters.dateRange.from, "yyyy-MM-dd")
        : undefined,
      dateTo: newFilters.dateRange?.to
        ? format(newFilters.dateRange.to, "yyyy-MM-dd")
        : undefined,
    };
    try {
      const images = await searchLocalImages(dbFilters);
      setAllImages(images);
    } catch (error) {
      console.error("Error searching local data:", error);
      setAllImages([]);
      toast({
        title: "Search Error",
        description: "Could not search local images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
      setHasAttemptedLoad(true);
    }
  }, []);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  useEffect(() => {
    return () => {
      logAllDetectedHostnames();
    };
  }, []);

  useEffect(() => {
    async function loadSyncedDates() {
      const dateStrings = await fetchDistinctSyncedDates();
      console.log("[HomePage] Raw date strings from DB:", dateStrings);
      const dates = dateStrings
        .map((originalString) => ({
          originalString,
          parsedDate: parseISO(originalString),
        }))
        .filter((item) => {
          const isValid =
            item.parsedDate instanceof Date &&
            !isNaN(item.parsedDate.getTime());
          if (!isValid) {
            console.warn(
              `[HomePage] Invalid date string encountered or parseISO failed for: ${item.originalString}`
            );
          }
          return isValid;
        })
        .map((item) => item.parsedDate);

      console.log("[HomePage] Parsed Date objects for syncedDays:", dates);
      setSyncedDays(dates);
    }
    loadSyncedDates();
  }, []);

  const filteredImages = useMemo(() => {
    return allImages;
  }, [allImages]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div className="flew-grow">
            <SearchControls
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onSearch={handleSearch}
              isLoading={isSearching || isSyncing}
              syncedDays={syncedDays}
            />
          </div>
          <Button
            onClick={handleSync}
            disabled={
              isSearching ||
              isSyncing ||
              !filters.dateRange?.from ||
              !filters.dateRange?.to
            }
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DownloadCloud className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? "Syncing with Hive..." : "Sync with Hive"}
          </Button>
        </div>

        {isSearching || isSyncing ? (
          <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">
              {isSyncing
                ? "Syncing images from Hive..."
                : "Searching local index..."}
            </p>
          </div>
        ) : !hasAttemptedLoad && allImages.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
            <DownloadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Welcome to Hive Image Lens!
            </h2>
            <p className="text-muted-foreground mb-1">
              To get started, please select a date range above.
            </p>
            <p className="text-muted-foreground mb-4">
              Then, click "Sync with Hive" to load image metadata into your
              local index.
            </p>
            <p className="text-muted-foreground">
              After syncing, use "Search Images" to explore the indexed images.
            </p>
          </div>
        ) : hasAttemptedLoad && allImages.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-lg text-muted-foreground">
              No images found matching your criteria.
            </p>
          </div>
        ) : (
          filteredImages.length > 0 && (
            <ImageResultsGrid images={filteredImages} />
          )
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Built with Next.js, ShadCN UI, and Genkit. Powered by Hive.
      </footer>
    </div>
  );
}
