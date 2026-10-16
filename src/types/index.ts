export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  email: string;
  username: string;
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
  resolution?: string; // e.g. "7680x4320 (8K FUHD)", "3840x2160 (4K UHD)"
  duration?: number;
  codec?: string;
  bitrate?: string;
  dimensions?: { width: number; height: number };
  pages?: number;
  format?: string;
  sha256?: string;
}

export interface FileItem {
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
  ratingAverage: number;
  ratingCount: number;
  ratingDistribution: Record<number, number>;
  createdAt: string;
  updatedAt: string;
  processingStatus: 'ready' | 'processing' | 'failed';
  isReported?: boolean;
}

export interface DownloadItem {
  id: string;
  fileId: string;
  userId: string;
  fileTitle: string;
  fileCategory: string;
  fileSizeBytes: number;
  downloadedAt: string;
}

export interface CollectionItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  fileIds: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  fileId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  parentId?: string;
}

export interface ReportItem {
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
  maxUploadSizeBytes: number;
  defaultUserStorageQuotaBytes: number;
  allowedFileCategories: string[];
  enablePublicRegistration: boolean;
  maintenanceMode: boolean;
  shutdownReason?: string;
  shutdownAt?: string;
}
