import type { HiveImage } from '@/lib/types';
import { ImageCard } from './image-card';
import { AlertTriangle } from 'lucide-react';

interface ImageResultsGridProps {
  images: HiveImage[];
  isLoading?: boolean;
}

export function ImageResultsGrid({ images, isLoading }: ImageResultsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card border rounded-lg shadow-md animate-pulse">
            <div className="p-4">
              <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
            </div>
            <div className="aspect-[3/2] bg-muted"></div>
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="flex flex-wrap gap-1">
                <div className="h-5 bg-muted rounded w-12"></div>
                <div className="h-5 bg-muted rounded w-16"></div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <div className="h-5 bg-muted rounded w-14"></div>
                <div className="h-5 bg-muted rounded w-10"></div>
              </div>
            </div>
            <div className="p-4 bg-muted/50 border-t">
               <div className="h-5 bg-muted rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
        <AlertTriangle className="w-16 h-16 mb-4 text-accent" />
        <h3 className="text-xl font-semibold mb-2">No Images Found</h3>
        <p className="text-sm">Try adjusting your search filters or syncing with Hive for new images.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
    </div>
  );
}
