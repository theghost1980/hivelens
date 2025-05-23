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
import { DownloadCloud, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
    title: "",
    tags: "",
    author: "",
    dateRange: undefined,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [syncedDays, setSyncedDays] = useState<Date[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 100;

  const handleSearch = useCallback(
    async (searchFilters: SearchFilters, targetPage: number) => {
      setIsSearching(true);

      const dbFilters = {
        searchTerm: searchFilters.searchTerm,
        title: searchFilters.title,
        tags: searchFilters.tags,
        author: searchFilters.author,
        dateFrom: searchFilters.dateRange?.from
          ? format(searchFilters.dateRange.from, "yyyy-MM-dd")
          : undefined,
        dateTo: searchFilters.dateRange?.to
          ? format(searchFilters.dateRange.to, "yyyy-MM-dd")
          : undefined,
      };

      try {
        const result = await searchLocalImages(
          dbFilters,
          targetPage,
          PAGE_SIZE
        );

        setAllImages(result.images);
        setTotalResults(result.totalCount);
        setCurrentPage(result.currentPage);
        setTotalPages(Math.ceil(result.totalCount / PAGE_SIZE));
        setHasAttemptedLoad(true);
      } catch (error) {
        console.error("Error searching local data:", error);
        setAllImages([]);
        setTotalResults(0);
        setCurrentPage(1);
        setTotalPages(0);
        toast({
          title: "Search Error",
          description:
            String(error) || "Could not search local images. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
        setHasAttemptedLoad(true);
      }
    },
    [toast]
  );

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

      await handleSearch(filters, 1);

      let description = `Sync complete. Found ${syncResult.images.length} raw images in this batch.`;
      description += `\nDB: ${syncResult.newImagesAdded} new, ${syncResult.existingImagesSkipped} duplicates skipped.`;
      description += `\n${syncResult.invalidOrInaccessibleImagesSkipped} invalid/broken URLs skipped.`;
      if (syncResult.dbErrors > 0)
        description += `\n${syncResult.dbErrors} DB errors.`;
      toast({
        title: "Sync Successful",
        description: description,
      });
    } catch (error) {
      console.error("Error syncing data:", error);
      toast({
        title: "Sync Error",
        description:
          String(error) ||
          "Could not fetch images from Hive. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, filters.dateRange, handleSearch]);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  const handleClearResults = useCallback(() => {
    setAllImages([]);
    setCurrentPage(1);
    setTotalPages(0);
    setTotalResults(0);
    // hasAttemptedLoad remains true, so the "No images found" message will appear.
    toast({
      title: "Results Cleared",
      description: "The search results have been cleared from view.",
    });
  }, [toast]);

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

  const filteredImages = allImages;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div className="flew-grow">
            <SearchControls
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onSearch={(currentSearchFilters) =>
                handleSearch(currentSearchFilters, 1)
              }
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
            <>
              <div className="flex justify-end mb-4">
                <Button
                  onClick={handleClearResults}
                  variant="outline"
                  disabled={isSearching || isSyncing}
                  size="sm"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear Results
                </Button>
              </div>
              <ImageResultsGrid images={filteredImages} />
            </>
          )
        )}

        {totalPages > 1 && !isSearching && !isSyncing && (
          <div className="flex justify-center items-center space-x-2 mt-8 pb-8">
            <Button
              onClick={() => handleSearch(filters, currentPage - 1)}
              disabled={currentPage <= 1}
              variant="outline"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalResults} results)
            </span>
            <Button
              onClick={() => handleSearch(filters, currentPage + 1)}
              disabled={currentPage >= totalPages}
              variant="outline"
            >
              Next
            </Button>
            +{" "}
          </div>
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Built with Next.js, ShadCN UI, and Genkit. Powered by Hive.
      </footer>
    </div>
  );
}
