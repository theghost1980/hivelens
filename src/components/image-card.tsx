import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HiveImage } from '@/lib/types';
import { ExternalLink, User, CalendarDays, Tags, BrainCircuit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ImageCardProps {
  image: HiveImage;
}

export function ImageCard({ image }: ImageCardProps) {
  const parsedDate = new Date(image.timestamp);
  const timeAgo = isNaN(parsedDate.getTime()) ? 'Invalid date' : formatDistanceToNow(parsedDate, { addSuffix: true });
  
  const displayImageUrl = image.imageUrl;
  let generatedAiHint = "";

  if (image.aiAnalysis && image.aiAnalysis.features.length > 0) {
    // Use first two features, or parts of them, for the hint
    generatedAiHint = image.aiAnalysis.features.map(f => f.split(':').pop()).slice(0, 2).join(' ').substring(0, 50);
  } else if (image.tags && image.tags.length > 0) {
    generatedAiHint = image.tags.slice(0, 2).join(' ');
  } else if (image.title) {
    // Take first two words of title
    generatedAiHint = image.title.split(/\s+/).slice(0, 2).join(' ');
  }
  generatedAiHint = generatedAiHint.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
  if (!generatedAiHint) {
    generatedAiHint = "image content"; // Fallback hint
  }


  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-4">
        <CardTitle className="text-lg truncate" title={image.title}>{image.title || 'Untitled Image'}</CardTitle>
        <CardDescription className="flex items-center text-xs text-muted-foreground">
          <User className="w-3 h-3 mr-1" />
          {image.author}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex-grow">
        <div className="aspect-[3/2] relative w-full bg-muted">
          <Image
            src={displayImageUrl}
            alt={image.title || 'Hive Image'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            data-ai-hint={generatedAiHint}
            priority={image.id.endsWith('-1') || image.id.endsWith('-0')} // Prioritize first image from a post
            onError={(e) => {
              // Optional: handle image loading errors, e.g. show a fallback
              // console.warn(`Error loading image: ${displayImageUrl}`, e);
              // (e.target as HTMLImageElement).src = 'https://placehold.co/600x400.png?text=Error';
            }}
          />
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3 mr-1" />
            {timeAgo}
          </div>
          {image.tags && image.tags.length > 0 && (
            <div className="flex items-start text-xs">
              <Tags className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {image.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
                {image.tags.length > 3 && <Badge variant="secondary">+{image.tags.length - 3}</Badge>}
              </div>
            </div>
          )}
          {image.aiAnalysis && (
            <div className="flex items-start text-xs">
              <BrainCircuit className="w-3 h-3 mr-1 mt-0.5 shrink-0 text-primary" />
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs border-primary/50 text-primary/90">{image.aiAnalysis.contentType}</Badge>
                {image.aiAnalysis.features.slice(0, 2).map((feature) => (
                  <Badge key={feature} variant="outline" className="text-xs">{feature}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 bg-muted/50">
        <Link
          href={image.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center"
        >
          View Post <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      </CardFooter>
    </Card>
  );
}
