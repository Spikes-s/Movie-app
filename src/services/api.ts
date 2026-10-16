import {
  FileItem,
  User,
  DownloadItem,
  CollectionItem,
  CommentItem,
  ReportItem,
  SystemSettings
} from '../types';

const TOKEN_KEY = 'vaultshare_jwt';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMsg = errorJson.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  async register(data: { email: string; username: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setStoredToken(res.token);
    return res;
  },

  async login(data: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setStoredToken(res.token);
    return res;
  },

  async googleLogin(data: { email: string; name?: string; avatarUrl?: string }): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/google-login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(updates: { username?: string; bio?: string; avatarUrl?: string }): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteAccount(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/account', {
      method: 'DELETE'
    });
  },

  // Files & Discovery
  async getFiles(params: {
    search?: string;
    category?: string;
    sort?: string;
    resolution?: string;
    tag?: string;
    visibility?: string;
    uploaderId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ files: FileItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.sort) query.set('sort', params.sort);
    if (params.resolution) query.set('resolution', params.resolution);
    if (params.tag) query.set('tag', params.tag);
    if (params.visibility) query.set('visibility', params.visibility);
    if (params.uploaderId) query.set('uploaderId', params.uploaderId);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    return request(`/api/files?${query.toString()}`);
  },

  async getFile(id: string): Promise<{ file: FileItem; isFavorited: boolean; userRating: number | null }> {
    return request(`/api/files/${id}`);
  },

  async getFileByShareToken(token: string): Promise<{ file: FileItem; isFavorited: boolean; userRating: number | null }> {
    return request(`/api/share/${token}`);
  },

  async updateFile(id: string, updates: Partial<FileItem>): Promise<{ file: FileItem }> {
    return request(`/api/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteFile(id: string): Promise<{ success: boolean }> {
    return request(`/api/files/${id}`, {
      method: 'DELETE'
    });
  },

  getStreamUrl(fileId: string): string {
    const token = getStoredToken();
    return token ? `/api/files/${fileId}/stream?token=${encodeURIComponent(token)}` : `/api/files/${fileId}/stream`;
  },

  getDownloadUrl(fileId: string): string {
    const token = getStoredToken();
    return token ? `/api/files/${fileId}/download?token=${encodeURIComponent(token)}` : `/api/files/${fileId}/download`;
  },

  // Ratings (1 to 10 stars)
  async rateFile(fileId: string, score: number): Promise<{
    fileId: string;
    userRating: number;
    ratingAverage: number;
    ratingCount: number;
    ratingDistribution: Record<number, number>;
  }> {
    return request(`/api/files/${fileId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ score })
    });
  },

  // Downloads
  async getUserDownloads(): Promise<{ downloads: DownloadItem[] }> {
    return request('/api/user/downloads');
  },

  async removeDownloadRecord(id: string): Promise<{ success: boolean }> {
    return request(`/api/user/downloads/${id}`, {
      method: 'DELETE'
    });
  },

  async clearUserDownloads(): Promise<{ success: boolean }> {
    return request('/api/user/downloads', {
      method: 'DELETE'
    });
  },

  // Personal Library & Favorites
  async getUserLibrary(): Promise<{
    storageUsedBytes: number;
    storageLimitBytes: number;
    myUploads: FileItem[];
    favoriteFiles: FileItem[];
    collections: CollectionItem[];
    downloadCount: number;
  }> {
    return request('/api/user/library');
  },

  async toggleFavorite(fileId: string): Promise<{ isFavorited: boolean }> {
    return request(`/api/files/${fileId}/favorite`, {
      method: 'POST'
    });
  },

  // Collections
  async getCollections(): Promise<{ collections: CollectionItem[] }> {
    return request('/api/user/collections');
  },

  async createCollection(data: { name: string; description?: string; isPublic?: boolean }): Promise<{ collection: CollectionItem }> {
    return request('/api/user/collections', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCollection(id: string, data: Partial<CollectionItem>): Promise<{ collection: CollectionItem }> {
    return request(`/api/user/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCollection(id: string): Promise<{ success: boolean }> {
    return request(`/api/user/collections/${id}`, {
      method: 'DELETE'
    });
  },

  // Comments
  async getComments(fileId: string): Promise<{ comments: CommentItem[] }> {
    return request(`/api/files/${fileId}/comments`);
  },

  async addComment(fileId: string, content: string, parentId?: string): Promise<{ comment: CommentItem }> {
    return request(`/api/files/${fileId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId })
    });
  },

  async deleteComment(commentId: string): Promise<{ success: boolean }> {
    return request(`/api/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  // Reports
  async submitReport(data: { targetType: 'file' | 'user'; targetId: string; targetTitle?: string; reason: string; notes?: string }): Promise<{ message: string }> {
    return request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Admin
  async getAdminOverview(): Promise<{
    metrics: {
      totalUsers: number;
      totalFiles: number;
      totalStorageBytes: number;
      totalDownloads: number;
      totalViews: number;
      pendingReportsCount: number;
    };
    categoryBreakdown: Record<string, number>;
    topDownloaded: FileItem[];
    pendingReports: ReportItem[];
  }> {
    return request('/api/admin/overview');
  },

  async getAdminUsers(): Promise<{ users: User[] }> {
    return request('/api/admin/users');
  },

  async setAdminUserRole(userId: string, role: string): Promise<{ user: User }> {
    return request(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  async setAdminUserStatus(userId: string, isSuspended: boolean): Promise<{ user: User }> {
    return request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isSuspended })
    });
  },

  async getAdminReports(): Promise<{ reports: ReportItem[] }> {
    return request('/api/admin/reports');
  },

  async updateAdminReport(reportId: string, status: 'resolved' | 'dismissed'): Promise<{ report: ReportItem }> {
    return request(`/api/admin/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async getAdminSettings(): Promise<{ settings: SystemSettings }> {
    return request('/api/admin/settings');
  },

  async updateAdminSettings(settings: Partial<SystemSettings>): Promise<{ settings: SystemSettings }> {
    return request('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  // Super Admin System Actions
  async getSystemStatus(): Promise<{
    maintenanceMode: boolean;
    appName: string;
    shutdownReason?: string;
    shutdownAt?: string;
  }> {
    return request('/api/system/status');
  },

  async shutdownWebsite(reason?: string): Promise<{ success: boolean; message: string; settings: SystemSettings }> {
    return request('/api/admin/system/shutdown', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async restoreWebsite(): Promise<{ success: boolean; message: string; settings: SystemSettings }> {
    return request('/api/admin/system/restore', {
      method: 'POST'
    });
  },

  async clearWebsiteData(confirmation: string): Promise<{
    success: boolean;
    message: string;
    stats: {
      deletedFiles: number;
      deletedUsers: number;
      deletedDownloads: number;
      deletedReports: number;
      deletedCollections: number;
      deletedRatings: number;
      deletedComments: number;
      preservedAdminEmail?: string;
    };
  }> {
    return request('/api/admin/system/clear-data', {
      method: 'POST',
      body: JSON.stringify({ confirmation })
    });
  },

  // Converter & Watermark-Free Link Extraction
  async extractMedia(url: string): Promise<{ mediaInfo: any }> {
    return request('/api/converter/extract', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  },

  async saveConvertedToVault(data: {
    title: string;
    thumbnailUrl: string;
    originalUrl: string;
    format: 'mp4' | 'mp3';
    quality: string;
  }): Promise<{ file: FileItem; message: string }> {
    return request('/api/converter/save-to-vault', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Account Password Recovery
  async forgotPassword(email: string): Promise<{ message: string; recoveryToken?: string }> {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(email: string, password: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  // Cloudflare R2 Object Storage Methods
  async getR2Status(): Promise<any> {
    return request('/api/r2/status');
  },

  async startR2Multipart(data: {
    filename: string;
    fileSizeBytes: number;
    mimeType: string;
    partSizeBytes?: number;
  }): Promise<any> {
    return request('/api/r2/multipart/start', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async signR2Part(data: {
    uploadId: string;
    objectKey: string;
    partNumber: number;
  }): Promise<{ partNumber: number; signedUrl: string; expiresInSeconds: number }> {
    return request('/api/r2/multipart/sign-part', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async completeR2Multipart(data: any): Promise<{ file: FileItem; verifiedSize: number; etag: string }> {
    return request('/api/r2/multipart/complete', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async abortR2Multipart(data: { uploadId: string; objectKey: string }): Promise<{ success: boolean }> {
    return request('/api/r2/multipart/abort', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Supabase PostgreSQL Integration Methods
  async getSupabaseStatus(): Promise<any> {
    return request('/api/supabase/status');
  },

  async getSupabaseMigration(): Promise<string> {
    const res = await fetch('/api/supabase/migration');
    return res.text();
  }
};

// Resumable & Direct Upload Engine with Progress & Pause/Resume
export interface UploadProgressCallback {
  (progress: {
    percentage: number;
    transferredBytes: number;
    totalBytes: number;
    speedBytesPerSec: number;
    estimatedSecondsRemaining: number;
    status: 'uploading' | 'assembling' | 'completed' | 'paused' | 'error';
    error?: string;
  }): void;
}

export class FileUploader {
  private file: File;
  private metadata: {
    title: string;
    description: string;
    category: string;
    tags: string[];
    visibility: string;
    resolution?: string;
    duration?: number;
    codec?: string;
    bitrate?: string;
    thumbnailDataUrl?: string;
  };
  private onProgress: UploadProgressCallback;
  private isPaused = false;
  private isCancelled = false;
  private currentXHR: XMLHttpRequest | null = null;
  private startTime = 0;

  constructor(
    file: File,
    metadata: {
      title: string;
      description: string;
      category: string;
      tags: string[];
      visibility: string;
      resolution?: string;
      duration?: number;
      codec?: string;
      bitrate?: string;
      thumbnailDataUrl?: string;
    },
    onProgress: UploadProgressCallback
  ) {
    this.file = file;
    this.metadata = metadata;
    this.onProgress = onProgress;
  }

  public pause() {
    this.isPaused = true;
    if (this.currentXHR) {
      this.currentXHR.abort();
    }
    this.onProgress({
      percentage: 0,
      transferredBytes: 0,
      totalBytes: this.file.size,
      speedBytesPerSec: 0,
      estimatedSecondsRemaining: 0,
      status: 'paused'
    });
  }

  public cancel() {
    this.isCancelled = true;
    if (this.currentXHR) {
      this.currentXHR.abort();
    }
  }

  // Uses Chunked Upload for files > 10MB or Direct for smaller files
  public async start(): Promise<FileItem> {
    this.startTime = Date.now();
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    if (this.file.size > CHUNK_SIZE) {
      return this.uploadInChunks(CHUNK_SIZE);
    } else {
      return this.uploadDirect();
    }
  }

  private async uploadDirect(): Promise<FileItem> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.currentXHR = xhr;
      const formData = new FormData();
      formData.append('file', this.file);
      formData.append('title', this.metadata.title);
      formData.append('description', this.metadata.description);
      formData.append('category', this.metadata.category);
      formData.append('tags', this.metadata.tags.join(','));
      formData.append('visibility', this.metadata.visibility);
      if (this.metadata.resolution) formData.append('resolution', this.metadata.resolution);
      if (this.metadata.duration) formData.append('duration', this.metadata.duration.toString());
      if (this.metadata.codec) formData.append('codec', this.metadata.codec);
      if (this.metadata.bitrate) formData.append('bitrate', this.metadata.bitrate);
      if (this.metadata.thumbnailDataUrl) formData.append('thumbnailDataUrl', this.metadata.thumbnailDataUrl);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const elapsed = (Date.now() - this.startTime) / 1000;
          const speed = elapsed > 0 ? evt.loaded / elapsed : 0;
          const remainingBytes = evt.total - evt.loaded;
          const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;
          const pct = Math.round((evt.loaded / evt.total) * 100);

          this.onProgress({
            percentage: pct,
            transferredBytes: evt.loaded,
            totalBytes: evt.total,
            speedBytesPerSec: speed,
            estimatedSecondsRemaining: eta,
            status: 'uploading'
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            this.onProgress({
              percentage: 100,
              transferredBytes: this.file.size,
              totalBytes: this.file.size,
              speedBytesPerSec: 0,
              estimatedSecondsRemaining: 0,
              status: 'completed'
            });
            resolve(data.file);
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          let errText = `Upload failed with status ${xhr.status}`;
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed.error) errText = parsed.error;
          } catch (e) {}
          reject(new Error(errText));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload cancelled or paused'));

      const token = getStoredToken();
      xhr.open('POST', '/api/files');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  private async uploadInChunks(chunkSize: number): Promise<FileItem> {
    const totalChunks = Math.ceil(this.file.size / chunkSize);
    const token = getStoredToken();

    // 1. Initialize session
    const initRes = await fetch('/api/upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        filename: this.file.name,
        totalChunks,
        totalSize: this.file.size,
        mimeType: this.file.type
      })
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({ error: 'Upload init failed' }));
      throw new Error(err.error || 'Failed to initialize chunk upload');
    }

    const { uploadId } = await initRes.json();
    let transferredBytes = 0;

    // 2. Upload each chunk
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (this.isCancelled) throw new Error('Upload cancelled');
      if (this.isPaused) throw new Error('Upload paused');

      const start = chunkIndex * chunkSize;
      const end = Math.min(this.file.size, start + chunkSize);
      const chunkBlob = this.file.slice(start, end);
      const chunkBuffer = await chunkBlob.arrayBuffer();

      const chunkUploaded = await new Promise<boolean>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        this.currentXHR = xhr;

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true);
          } else {
            reject(new Error(`Chunk ${chunkIndex} upload failed: status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error(`Network error on chunk ${chunkIndex}`));
        xhr.onabort = () => reject(new Error('Upload interrupted'));

        xhr.open('POST', '/api/upload/chunk');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('x-upload-id', uploadId);
        xhr.setRequestHeader('x-chunk-index', chunkIndex.toString());
        xhr.send(chunkBuffer);
      });

      if (!chunkUploaded) throw new Error(`Chunk ${chunkIndex} failed`);

      transferredBytes += chunkBlob.size;
      const elapsed = (Date.now() - this.startTime) / 1000;
      const speed = elapsed > 0 ? transferredBytes / elapsed : 0;
      const remainingBytes = this.file.size - transferredBytes;
      const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;
      const pct = Math.round((transferredBytes / this.file.size) * 100);

      this.onProgress({
        percentage: pct,
        transferredBytes,
        totalBytes: this.file.size,
        speedBytesPerSec: speed,
        estimatedSecondsRemaining: eta,
        status: 'uploading'
      });
    }

    // 3. Assemble and finalize
    this.onProgress({
      percentage: 100,
      transferredBytes: this.file.size,
      totalBytes: this.file.size,
      speedBytesPerSec: 0,
      estimatedSecondsRemaining: 0,
      status: 'assembling'
    });

    const completeRes = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        uploadId,
        title: this.metadata.title,
        description: this.metadata.description,
        category: this.metadata.category,
        tags: this.metadata.tags,
        visibility: this.metadata.visibility,
        resolution: this.metadata.resolution,
        duration: this.metadata.duration,
        codec: this.metadata.codec,
        bitrate: this.metadata.bitrate,
        originalFilename: this.file.name,
        mimeType: this.file.type,
        thumbnailDataUrl: this.metadata.thumbnailDataUrl
      })
    });

    if (!completeRes.ok) {
      const err = await completeRes.json().catch(() => ({ error: 'Assembly failed' }));
      throw new Error(err.error || 'Failed to assemble uploaded media');
    }

    const completeData = await completeRes.json();
    this.onProgress({
      percentage: 100,
      transferredBytes: this.file.size,
      totalBytes: this.file.size,
      speedBytesPerSec: 0,
      estimatedSecondsRemaining: 0,
      status: 'completed'
    });

    return completeData.file;
  }
}
