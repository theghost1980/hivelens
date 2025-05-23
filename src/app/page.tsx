"use client";

import { ImageResultsGrid } from "@/components/image-results-grid";
import { SearchControls } from "@/components/search-controls";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import type { HiveImage, SearchFilters } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { Loader2, XCircle } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  checkIfDateRangeHasData,
  fetchAllUniqueTags,
  fetchDistinctSyncedDates,
  searchLocalImages,
  syncHiveData,
} from "./actions";

const PAGE_SIZE = 100;

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
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { toast } = useToast();

  const debouncedFilters = useDebounce(filters, 10);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters((prev) => {
      const same = JSON.stringify(prev) === JSON.stringify(newFilters);
      return same ? prev : newFilters;
    });
    setCurrentPage(1);
  }, []);

  const handleSearch = useCallback(
    async (searchFilters: SearchFilters, targetPage: number) => {
      setIsSearching(true);

      try {
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
          description: String(error) || "Search failed. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const minChars = 3;

    const textFieldsValid = ["searchTerm", "author", "title", "tags"].every(
      (key) => {
        const val = (debouncedFilters as any)[key];
        if (!val) return true;
        if (key === "tags") {
          return val
            .split(",")
            .every((t: string) => t.trim().length >= minChars);
        }
        return val.length >= minChars || val.length === 0;
      }
    );

    if (!initialLoadComplete || !textFieldsValid) return;

    handleSearch(debouncedFilters, currentPage);
  }, [debouncedFilters, currentPage, handleSearch, initialLoadComplete]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (!filters.dateRange?.from || !filters.dateRange?.to) {
        toast({
          title: "Date Range Required",
          description: "Please select a date range to sync.",
          variant: "destructive",
        });
        return;
      }

      const startDateStr = format(filters.dateRange.from, "yyyy-MM-dd");
      const endDateStr = format(filters.dateRange.to, "yyyy-MM-dd");

      const hasData = await checkIfDateRangeHasData(startDateStr, endDateStr);
      if (hasData && !window.confirm("Data already exists. Sync anyway?")) {
        return;
      }

      const response = await syncHiveData(startDateStr, endDateStr);
      if (response.status === "confirmation_required") {
        if (!window.confirm(response.message)) return;

        const finalResult = await syncHiveData(startDateStr, endDateStr, {
          confirmed: true,
        });
        if (finalResult.status === "success") {
          const descriptionParts = [
            `Sync complete. ${finalResult.newImagesAdded} new images added.`,
            `${finalResult.existingImagesSkipped} duplicates skipped.`,
            `${finalResult.invalidOrInaccessibleImagesSkipped} invalid/broken URLs skipped.`,
          ];
          if (finalResult.dbErrors && finalResult.dbErrors > 0) {
            descriptionParts.push(`${finalResult.dbErrors} DB errors.`);
          }
          toast({
            title: "Sync Successful",
            description: descriptionParts.join("\n"),
          });
          await handleSearch(filters, 1);
        } else if (finalResult.status === "error") {
          toast({
            title: "Sync Error",
            description: finalResult.message,
            variant: "destructive",
          });
        }
      } else if (response.status === "success") {
        await handleSearch(filters, 1);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Sync Error",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [filters.dateRange, toast, handleSearch]);

  useEffect(() => {
    fetchDistinctSyncedDates().then((dates) => {
      const parsed = dates
        .map((d) => parseISO(d))
        .filter((d) => d instanceof Date && !isNaN(d.getTime()));
      setSyncedDays(parsed);
      setInitialLoadComplete(true);
    });
  }, []);

  useEffect(() => {
    fetchAllUniqueTags().then(setAvailableTags);
  }, []);

  const handleClearResults = useCallback(() => {
    setAllImages([]);
    setTotalPages(0);
    setTotalResults(0);
    setCurrentPage(1);
    toast({ title: "Results cleared." });
  }, [toast]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow container mx-auto px-4 py-8">
        {/* Encabezado con Logo y Título */}
        <header className="mb-12 flex items-center gap-4">
          <div className="flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Hivelens Logo"
              width={60}
              height={60}
              priority
            />
          </div>
          {/* Título y Slogan */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-primary">
              Hivelens
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Explore and discover images from the HIVE blockchain.
            </p>
          </div>
        </header>

        {/* Sección de Controles de Búsqueda y Sincronización */}
        <section className="mb-8">
          <SearchControls
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearch={() => handleSearch(filters, 1)}
            availableTags={availableTags}
            isSearching={isSearching}
            syncedDays={syncedDays}
            onSync={handleSync}
            isSyncing={isSyncing}
          />

          {/* Sección Expandible de Explicación del Sync */}
          <Accordion type="single" collapsible className="w-full mt-6">
            <AccordionItem value="sync-explanation">
              <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline font-semibold">
                How does the synchronization process work?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2 pt-2">
                <p>
                  The synchronization process connects to the HIVE blockchain to
                  fetch posts within the selected date range.
                </p>
                <p>
                  For each post, it extracts image URLs, validates them to
                  ensure they are accessible and actual images, and then stores
                  the image metadata (like author, post link, tags, and the
                  image URL itself) in a local SQLite database.
                </p>
                <p>
                  If you select a large date range, this process can take some
                  time (approx. 40 minutes per day of data). You will be asked
                  for confirmation if the estimated time is significant.
                </p>
                <p>
                  Once synced, you can search these images instantly using the
                  filters above.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {isSearching || isSyncing ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
        ) : !hasAttemptedLoad && allImages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            Welcome. Please select a date range and click sync to begin.
          </div>
        ) : allImages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No images match your filters.
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={handleClearResults} size="sm" variant="outline">
                <XCircle className="mr-2 h-4 w-4" />
                Clear Results
              </Button>
            </div>
            <ImageResultsGrid images={allImages} />
          </>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button
              onClick={() => handleSearch(filters, currentPage - 1)}
              disabled={currentPage <= 1}
              variant="outline"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              onClick={() => handleSearch(filters, currentPage + 1)}
              disabled={currentPage >= totalPages}
              variant="outline"
            >
              Next
            </Button>
          </div>
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Built with Next.js, ShadCN UI, and Genkit. Powered by Hive & HiveSQL.
      </footer>
    </div>
  );
}
