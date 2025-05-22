'use server';

/**
 * @fileOverview An image analysis AI agent.
 *
 * - analyzeImageContent - A function that handles the image analysis process.
 * - AnalyzeImageContentInput - The input type for the analyzeImageContent function.
 * - AnalyzeImageContentOutput - The return type for the analyzeImageContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeImageContentInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeImageContentInput = z.infer<typeof AnalyzeImageContentInputSchema>;

const AnalyzeImageContentOutputSchema = z.object({
  contentType: z.string().describe('The content type of the image (e.g., landscape, portrait, object).'),
  features: z.array(z.string()).describe('Relevant features identified in the image (e.g., sky, trees, person).'),
});
export type AnalyzeImageContentOutput = z.infer<typeof AnalyzeImageContentOutputSchema>;

export async function analyzeImageContent(input: AnalyzeImageContentInput): Promise<AnalyzeImageContentOutput> {
  return analyzeImageContentFlow(input);
}

const analyzeImageContentPrompt = ai.definePrompt({
  name: 'analyzeImageContentPrompt',
  input: {schema: AnalyzeImageContentInputSchema},
  output: {schema: AnalyzeImageContentOutputSchema},
  prompt: `You are an expert image analyzer. Analyze the image and identify its content type and relevant features.

  Photo: {{media url=photoDataUri}}

  Content Type: (e.g., landscape, portrait, object)
  Features: (e.g., sky, trees, person)`,
});

const analyzeImageContentFlow = ai.defineFlow(
  {
    name: 'analyzeImageContentFlow',
    inputSchema: AnalyzeImageContentInputSchema,
    outputSchema: AnalyzeImageContentOutputSchema,
  },
  async input => {
    const {output} = await analyzeImageContentPrompt(input);
    return output!;
  }
);
