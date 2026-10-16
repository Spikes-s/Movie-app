export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  bio?: string;
  isEmailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  storageUsedBytes: number;
  storageLimitBytes: number;
  isSuspended?: boolean;
}

export type FileCategory = 
  | 'video'
  | 'audio'
  | 'image'
  | 'document'
  | 'archive'
  | 'software'
  | 'ebook'
  | 'design'
  | 'other';

export type FileVisibility = 'public' | 'unlisted' | 'private';

export interface FileMetadata {
  resolution?: string; // e.g. "3840x2160 (4K)", "7680x4320 (8K)", "1920x1080 (FHD)"
  duration?: number; // seconds
  codec?: string; // h264, vp9, av1, aac, flac
  bitrate?: string;
  dimensions?: { width: number; height: number };
  pages?: number;
  format?: string;
  sha256?: string;
}

export interface FileRecord {
  id: string;
  userId: string;
  uploaderName: string;
  uploaderAvatar?: string;
  title: string;
  description: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  category: FileCategory;
  tags: string[];
  visibility: FileVisibility;
  shareToken?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  metadata: FileMetadata;
  viewsCount: number;
  downloadsCount: number;
  ratingAverage: number; // 1.0 - 10.0
  ratingCount: number;
  ratingDistribution: Record<number, number>; // 1 to 10
  createdAt: string;
  updatedAt: string;
  processingStatus: 'ready' | 'processing' | 'failed';
  isReported?: boolean;
}

export interface RatingRecord {
  id: string;
  fileId: string;
  userId: string;
  score: number; // 1 to 10
  createdAt: string;
  updatedAt: string;
}

export interface DownloadRecord {
  id: string;
  fileId: string;
  userId: string;
  fileTitle: string;
  fileCategory: string;
  fileSizeBytes: number;
  downloadedAt: string;
  ip?: string;
}

export interface FavoriteRecord {
  id: string;
  fileId: string;
  userId: string;
  createdAt: string;
}

export interface CollectionRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  fileIds: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRecord {
  id: string;
  fileId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  parentId?: string; // for replies
}

export interface ReportRecord {
  id: string;
  reporterUserId: string;
  reporterName: string;
  targetType: 'file' | 'user';
  targetId: string;
  targetTitle?: string;
  reason: 'copyright' | 'malware' | 'spam' | 'inappropriate' | 'other';
  notes: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SystemSettings {
  appName: string;
  primaryColor: string;
  maxUploadSizeBytes: number; // e.g. 50GB = 53687091200
  defaultUserStorageQuotaBytes: number; // e.g. 20GB = 21474836480
  allowedFileCategories: string[];
  enablePublicRegistration: boolean;
  maintenanceMode: boolean;
}
