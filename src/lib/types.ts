export interface AIAnalysis {
  contentType: string;
  features: string[];
}

export interface HiveImage {
  id: string;
  imageUrl: string;
  author: string;
  timestamp: string; // ISO string date
  title: string;
  postUrl: string; // Link to the hive post/comment
  aiAnalysis?: AIAnalysis;
  tags?: string[]; // General tags, could be from post or AI
}
