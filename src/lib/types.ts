import { DateRange } from "react-day-picker";

export interface AIAnalysis {
  contentType: string;
  features: string[];
}

export interface HiveImage {
  id: string;
  imageUrl: string;
  author: string;
  timestamp: string;
  title: string;
  postUrl: string;
  aiAnalysis?: AIAnalysis;
  tags?: string[];
}

export interface SearchFilters {
  searchTerm: string;
  title?: string;
  tags?: string;
  author: string;
  dateRange?: DateRange;
  searchInBody?: boolean;
}

export interface SearchControlsProps {
  onSearch: (filters: SearchFilters) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  syncedDays?: Date[];
  isSearching?: boolean;
  availableTags: string[];
  onSync: () => void;
  isSyncing?: boolean;
}

export interface ImageRecord {
  image_url: string;
  hive_author?: string;
  hive_permlink?: string;
  hive_post_url?: string;
  hive_title?: string;
  hive_timestamp?: string;
  hive_tags?: string;
}

export interface SearchFiltersDb {
  searchTerm?: string;
  author?: string;
  title?: string;
  tags?: string;
  dateFrom?: string;
  dateTo?: string;
}
export interface RawHiveDataRow {
  id: number;
  image_url: string;
  hive_author: string;
  hive_permlink: string;
  hive_post_url: string;
  hive_title: string;
  hive_timestamp: string;
  hive_tags: string | null;
  ai_content_type: string | null;
  ai_features: string | null;
}

export interface HivePostCommentForSync {
  author: string;
  timestamp: Date;
  title: string;
  permlink: string;
  json_metadata: string;
  postUrl: string;
}

export interface SyncSuccessResult {
  status: "success";
  images: HiveImage[];
  newImagesAdded: number;
  existingImagesSkipped: number;
  invalidOrInaccessibleImagesSkipped: number;
  dbErrors: number;
  message: string;
  currentDbSizeMB?: number;
}

export interface SyncConfirmationRequiredResult {
  status: "confirmation_required";
  estimatedDays: number;
  estimatedTimePerDayMinutes: number;
  totalEstimatedTimeMinutes: number;
  message: string;
  currentDbSizeMB?: number;
}
export interface SyncErrorResult {
  status: "error";
  message: string;
  newImagesAdded?: number;
  existingImagesSkipped?: number;
  invalidOrInaccessibleImagesSkipped?: number;
  dbErrors?: number;
  currentDbSizeMB?: number;
}

export interface SyncInProgressDetailedErrorResult {
  status: "sync_in_progress";
  message: string; // Mensaje genérico como "La sincronización ya está en progreso."
  details?: string; // Mensaje detallado de getSyncStatus
  syncStatus?: {
    // Objeto de estado completo de getSyncStatus
    username: string;
    initiatedAt: string;
    dateRange: { from: string; to: string } | string;
    estimatedDurationMinutes: number;
    estimatedCompletionTime: string;
  } | null;
  currentDbSizeMB?: number;
}

// Definición del Error Personalizado
export class SyncInProgressError extends Error {
  public statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "SyncInProgressError";
    this.statusCode = 409; // Conflict
  }
}

export type SyncAndStoreResult =
  | SyncSuccessResult
  | SyncConfirmationRequiredResult
  | SyncErrorResult
  | SyncQuotaExceededResult
  | SyncInProgressDetailedErrorResult; // Añadido el nuevo tipo de resultado

export interface SyncQuotaExceededResult {
  status: "quota_exceeded";
  message: string;
  currentDbSizeMB?: number;
  maxDbSizeMB?: number;
}
