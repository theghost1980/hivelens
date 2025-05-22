'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { HiveImage } from '@/lib/types';
import { AppHeader } from '@/components/layout/app-header';
import { SearchControls, type SearchFilters } from '@/components/search-controls';
import { ImageResultsGrid } from '@/components/image-results-grid';
import { Button } from '@/components/ui/button';
import { syncHiveData } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DownloadCloud } from 'lucide-react';
import { format, parseISO } from 'date-fns';


export default function HomePage() {
  const [allImages, setAllImages] = useState<HiveImage[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({ searchTerm: '', author: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // Separate loading for search
  const { toast } = useToast();

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const images = await syncHiveData();
      setAllImages(images);
      toast({
        title: 'Sync Complete',
        description: `Fetched ${images.length} images from Hive.`,
      });
    } catch (error) {
      console.error('Error syncing data:', error);
      toast({
        title: 'Sync Error',
        description: 'Could not fetch images from Hive. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  // Trigger initial sync on component mount
  useEffect(() => {
    // Check if data is already synced (e.g. from a previous session if we had persistence)
    // For now, always sync if allImages is empty.
    if (allImages.length === 0) {
      handleSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  const handleSearch = useCallback((newFilters: SearchFilters) => {
    setIsSearching(true);
    setFilters(newFilters);
    // Simulate search delay or processing
    setTimeout(() => setIsSearching(false), 300);
  }, []);
  
  const filteredImages = useMemo(() => {
    return allImages.filter((image) => {
      const searchTermLower = filters.searchTerm.toLowerCase();
      const authorLower = filters.author.toLowerCase();

      const matchesSearchTerm =
        !searchTermLower ||
        image.title.toLowerCase().includes(searchTermLower) ||
        (image.tags && image.tags.some(tag => tag.toLowerCase().includes(searchTermLower))) ||
        (image.aiAnalysis && 
          (image.aiAnalysis.contentType.toLowerCase().includes(searchTermLower) || 
           image.aiAnalysis.features.some(feat => feat.toLowerCase().includes(searchTermLower)))
        );

      const matchesAuthor =
        !authorLower || image.author.toLowerCase().includes(authorLower);
      
      const matchesDateRange = () => {
        if (!filters.dateRange || !filters.dateRange.from) return true;
        const imageDate = parseISO(image.timestamp);
        if (isNaN(imageDate.getTime())) return false; // Invalid image date

        const fromDate = filters.dateRange.from;
        const toDate = filters.dateRange.to || filters.dateRange.from; // If 'to' is not set, use 'from' for single day

        // Adjust toDate to include the whole day
        const toDateEndOfDay = new Date(toDate);
        toDateEndOfDay.setHours(23, 59, 59, 999);
        
        return imageDate >= fromDate && imageDate <= toDateEndOfDay;
      };

      return matchesSearchTerm && matchesAuthor && matchesDateRange();
    });
  }, [allImages, filters]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hive Image Explorer
          </h1>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DownloadCloud className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? 'Syncing with Hive...' : 'Sync with Hive'}
          </Button>
        </div>

        <SearchControls onSearch={handleSearch} isLoading={isSearching || isSyncing} initialFilters={filters} />
        
        {isSyncing && allImages.length === 0 ? (
           <div className="flex flex-col items-center justify-center text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Loading images from Hive...</p>
          </div>
        ) : (
          <ImageResultsGrid images={filteredImages} isLoading={isSearching} />
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Built with Next.js, ShadCN UI, and Genkit. Powered by Hive.
      </footer>
    </div>
  );
}
