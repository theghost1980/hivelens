'use server';

import type { HiveImage } from '@/lib/types';
// The Genkit AI flow is available but not directly called in this mock sync 
// to avoid complexities with data URI conversion for remote images in a scaffold.
// import { analyzeImageContent } from '@/ai/flows/analyze-image-content';

// Helper to generate a placeholder data URI string if needed by AI flow.
// In a real scenario, this would fetch an image and convert it.
// For this scaffold, we're mocking AI analysis results directly.
// async function getPlaceholderDataUri(imageUrl: string): Promise<string> {
//   // Example: 1x1 transparent PNG
//   return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
// }

export async function syncHiveData(): Promise<HiveImage[]> {
  // Simulate fetching data from HiveSQL
  const mockPostsFromHive = [
    { id: 'post1', author: 'hivelover', timestamp: new Date(2023, 0, 15, 10, 30).toISOString(), title: 'My Awesome Trip to the Mountains', images: ['https://placehold.co/600x400.png'], postUrl: 'https://hive.blog/hivelover/awesome-trip', tags: ['travel', 'mountains', 'nature'] },
    { id: 'post2', author: 'photoguru', timestamp: new Date(2023, 1, 20, 14,0).toISOString(), title: 'Forest Wonders', images: ['https://placehold.co/300x200.png', 'https://placehold.co/400x300.png'], postUrl: 'https://hive.blog/photoguru/forest-wonders', tags: ['photography', 'forest', 'landscape'] },
    { id: 'post3', author: 'cityexplorer', timestamp: new Date(2023, 2, 10, 18,45).toISOString(), title: 'Urban Jungle: City Lights', images: ['https://placehold.co/600x400.png'], postUrl: 'https://hive.blog/cityexplorer/urban-jungle', tags: ['city', 'urban', 'nightlife'] },
    { id: 'post4', author: 'techwiz', timestamp: new Date(2024, 5, 1, 9,15).toISOString(), title: 'Highlights from Tech Expo 2024', images: ['https://placehold.co/320x240.png', 'https://placehold.co/640x480.png'], postUrl: 'https://hive.blog/techwiz/tech-expo-2024', tags: ['technology', 'conference', 'innovation'] },
    { id: 'post5', author: 'foodiequeen', timestamp: new Date(2024, 4, 25, 12,0).toISOString(), title: 'Delicious Street Food Adventures', images: ['https://placehold.co/500x350.png'], postUrl: 'https://hive.blog/foodiequeen/street-food', tags: ['food', 'travel', 'streetfood'] },
  ];

  const allImages: HiveImage[] = [];
  let imageIdCounter = 0;

  const aiHints: { [key: string]: string } = {
    'https://placehold.co/600x400.png_post1': 'landscape mountain', // My Awesome Trip
    'https://placehold.co/300x200.png_post2': 'nature forest',    // Forest Wonders 1
    'https://placehold.co/400x300.png_post2': 'nature lake',      // Forest Wonders 2
    'https://placehold.co/600x400.png_post3': 'city skyline',   // Urban Jungle
    'https://placehold.co/320x240.png_post4': 'tech conference', // Tech Expo 1
    'https://placehold.co/640x480.png_post4': 'gadgets devices',  // Tech Expo 2
    'https://placehold.co/500x350.png_post5': 'food street food', // Street Food
  };


  for (const post of mockPostsFromHive) {
    for (const imageUrl of post.images) {
      imageIdCounter++;
      const uniqueImageKey = `${imageUrl}_${post.id}`;
      const currentAiHint = aiHints[uniqueImageKey] || 'abstract pattern';
      
      // Modify imageUrl to include data-ai-hint
      const placeholderUrl = new URL(imageUrl);
      // Remove existing text query param if any, to avoid conflicts
      placeholderUrl.searchParams.delete('text');
      const hintAdjustedImageUrl = `${placeholderUrl.origin}${placeholderUrl.pathname}`;


      const image: HiveImage = {
        id: `img-${imageIdCounter}`,
        // Use hintAdjustedImageUrl which does not include text param for placeholder
        imageUrl: hintAdjustedImageUrl, 
        author: post.author,
        timestamp: post.timestamp,
        title: `${post.title} (Image ${imageIdCounter})`,
        postUrl: post.postUrl,
        tags: post.tags,
        // Mock AI analysis - this would be the result stored in a local DB after calling Gemini
        aiAnalysis: {
          contentType: post.tags.includes('nature') || post.tags.includes('travel') ? 'Scenery' : (post.tags.includes('city') || post.tags.includes('urban')) ? 'Urban Scene' : post.tags.includes('technology') ? 'Tech Product' : 'General',
          features: [`color:blue`, `object:${currentAiHint.split(" ")[0]}`, `mood:${post.tags[0]}`],
        },
      };
      // Add data-ai-hint for actual image fetching
      image.imageUrl = `${image.imageUrl}?ai_hint=${encodeURIComponent(currentAiHint)}`;
      allImages.push(image);
    }
  }

  // Simulate network delay for fetching and processing
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return allImages;
}

// This function is a placeholder for how you might trigger analysis for a single image
// if you had its data URI. Not used in the main sync flow for simplicity.
/*
export async function analyzeSingleImageWithAI(photoDataUri: string): Promise<AIAnalysis | null> {
  try {
    const analysis = await analyzeImageContent({ photoDataUri });
    return analysis;
  } catch (error) {
    console.error("Error analyzing image with AI:", error);
    return null;
  }
}
*/
