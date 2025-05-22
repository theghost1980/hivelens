
'use server';

import type { HiveImage, AIAnalysis } from '@/lib/types';
import { executeQuery } from '@/lib/hivesql';
// The Genkit AI flow is available but not directly called in this mock sync 
// to avoid complexities with data URI conversion for remote images in a scaffold.
// import { analyzeImageContent } from '@/ai/flows/analyze-image-content';

interface HivePostComment {
  author: string;
  timestamp: Date; // SQL returns Date objects for datetime types
  title: string;
  permlink: string;
  json_metadata: string; // This is a JSON string
  postUrl: string; // This will be constructed
}

// Helper to safely parse JSON metadata
function parseJsonMetadata(metadataString: string): { image?: string[], tags?: string[], [key: string]: any } {
  if (!metadataString) return {};
  try {
    const parsed = JSON.parse(metadataString);
    return {
      image: Array.isArray(parsed.image) ? parsed.image.filter(img => typeof img === 'string' && img.startsWith('http')) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter(tag => typeof tag === 'string') : [],
      ...parsed
    };
  } catch (e) {
    // console.warn('Error parsing json_metadata:', e, "Metadata string:", metadataString);
    return {}; // Return empty object or default structure on error
  }
}


export async function syncHiveData(): Promise<HiveImage[]> {
  console.log('Starting Hive data sync...');
  
  // Fetch posts from the last 7 days that likely contain images
  // depth = 0 filters for top-level posts.
  const query = `
    SELECT
        author,
        created AS timestamp,
        title,
        permlink,
        json_metadata,
        CONCAT('https://hive.blog/@', author, '/', permlink) as postUrl
    FROM Comments
    WHERE
        depth = 0 
        AND created >= DATEADD(day, -7, GETUTCDATE())
        AND (json_metadata LIKE '%"image":%' OR json_metadata LIKE '%"images":%')
    ORDER BY created DESC;
  `;

  try {
    const { results: rawPosts, time } = await executeQuery<HivePostComment>(query);
    console.log(`Fetched ${rawPosts.length} raw posts from HiveSQL in ${time}ms.`);

    const allImages: HiveImage[] = [];
    let imageIdCounter = 0;

    for (const post of rawPosts) {
      if (!post.json_metadata) {
        // console.log(`Skipping post by ${post.author}/${post.permlink} due to missing json_metadata`);
        continue;
      }
      
      const metadata = parseJsonMetadata(post.json_metadata);
      const postImages = metadata.image || [];
      const postTags = metadata.tags || [];

      if (postImages.length === 0) {
        // console.log(`Skipping post by ${post.author}/${post.permlink} as no images found in metadata.image`);
        continue;
      }
      
      for (const imageUrl of postImages) {
        if (!imageUrl || !imageUrl.startsWith('http')) {
          // console.log(`Skipping invalid image URL: ${imageUrl} in post ${post.author}/${post.permlink}`);
          continue;
        }

        imageIdCounter++;
        
        // Mock AI analysis based on tags (as Genkit flow is not active here)
        const aiContentType = postTags.includes('nature') || postTags.includes('travel') || postTags.includes('landscape') ? 'Scenery' :
                              postTags.includes('city') || postTags.includes('urban') ? 'Urban Scene' :
                              postTags.includes('technology') ? 'Tech Product' :
                              postTags.includes('food') ? 'Food' :
                              postTags.includes('portrait') || postTags.includes('people') ? 'Portrait' :
                              'General';
        
        const aiFeatures: string[] = [];
        if (postTags.length > 0) {
            aiFeatures.push(`tag:${postTags[0].toLowerCase()}`); // First tag as a feature
            if (postTags.length > 1) {
                 aiFeatures.push(`tag:${postTags[1].toLowerCase()}`); // Second tag as a feature
            }
        } else {
            aiFeatures.push("general-content");
        }
        aiFeatures.push(`type:${aiContentType.toLowerCase().replace(/\s+/g, '-')}`);


        const image: HiveImage = {
          id: `img-${post.author}-${post.permlink}-${imageIdCounter}`,
          imageUrl: imageUrl,
          author: post.author,
          timestamp: post.timestamp.toISOString(), // Convert Date to ISO string
          title: post.title || `Image from ${post.author}`,
          postUrl: post.postUrl,
          tags: postTags,
          aiAnalysis: {
            contentType: aiContentType,
            features: aiFeatures,
          },
        };
        allImages.push(image);
      }
    }
    
    console.log(`Processed ${allImages.length} images from fetched posts.`);
    // Simulate additional processing delay if needed, but real query time is main factor now
    // await new Promise(resolve => setTimeout(resolve, 500)); 
    
    return allImages;

  } catch (error) {
    console.error('Error during syncHiveData:', error);
    // Return empty array or re-throw, depending on how page should handle it
    return []; 
  }
}

// This function is a placeholder for how you might trigger analysis for a single image
// if you had its data URI. Not used in the main sync flow for simplicity.
/*
export async function analyzeSingleImageWithAI(photoDataUri: string): Promise<AIAnalysis | null> {
  try {
    // This would require fetching the image from imageUrl, converting to data URI
    // const photoDataUri = await convertImageUrlToDataUri(imageUrl); 
    const analysis = await analyzeImageContent({ photoDataUri });
    return analysis;
  } catch (error) {
    console.error("Error analyzing image with AI:", error);
    return null;
  }
}
*/
