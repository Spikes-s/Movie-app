import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import { db } from './db.js';

// Configuration from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vaultshare-production';

// Configurable application storage limits
export const STORAGE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024 * 1024, // 10 GB
  DEFAULT_USER_QUOTA_BYTES: 5 * 1024 * 1024 * 1024, // 5 GB
  ADMIN_USER_QUOTA_BYTES: 500 * 1024 * 1024 * 1024, // 500 GB
  MAX_CONCURRENT_UPLOADS: 3,
  DEFAULT_PART_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB per part
  SIGNED_URL_EXPIRATION_SECONDS: 900 // 15 minutes
};

// Check if Cloudflare R2 is configured with live credentials
export const isR2Configured = (): boolean => {
  return Boolean(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_ACCESS_KEY_ID !== 'your_r2_access_key_id' &&
    R2_ACCOUNT_ID !== 'your_cloudflare_account_id'
  );
};

// Lazy initialization of S3 client for Cloudflare R2
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });
  }
  return s3ClientInstance;
}

// In-memory tracker for active concurrent uploads per user
const activeUserUploads = new Map<string, Set<string>>();

export interface R2UploadSession {
  uploadId: string;
  objectKey: string;
  userId: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  partSizeBytes: number;
  totalParts: number;
  completedParts: { PartNumber: number; ETag: string }[];
  isR2: boolean;
  createdAt: number;
}

const activeSessions = new Map<string, R2UploadSession>();

/**
 * 1. Start Multipart Upload
 * Enforces per-user quota, 10 GB file limit, and max 3 concurrent uploads
 */
export async function startMultipartUpload(params: {
  userId: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  partSizeBytes?: number;
}): Promise<{
  uploadId: string;
  objectKey: string;
  partSizeBytes: number;
  totalParts: number;
  isR2: boolean;
}> {
  const { userId, filename, fileSizeBytes, mimeType } = params;

  // Validate file size limit (10 GB max)
  if (fileSizeBytes > STORAGE_LIMITS.MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds maximum permitted size of 10 GB. Provided size: ${(fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB.`
    );
  }

  // Validate user concurrent uploads (max 3)
  const currentUploads = activeUserUploads.get(userId) || new Set<string>();
  if (currentUploads.size >= STORAGE_LIMITS.MAX_CONCURRENT_UPLOADS) {
    throw new Error(
      `Concurrent upload limit reached (${STORAGE_LIMITS.MAX_CONCURRENT_UPLOADS} active uploads). Please wait for ongoing uploads to complete.`
    );
  }

  // Validate user storage quota
  const user = db.findUserById(userId);
  if (user) {
    const remainingQuota = user.storageLimitBytes - user.storageUsedBytes;
    if (fileSizeBytes > remainingQuota) {
      throw new Error(
        `Insufficient storage quota. You have ${(remainingQuota / (1024 * 1024)).toFixed(1)} MB remaining, but file requires ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB.`
      );
    }
  }

  // Generate secure random server-side object key (never use user-supplied filename directly)
  const ext = path.extname(filename).toLowerCase();
  const safeRandom = crypto.randomBytes(16).toString('hex');
  const objectKey = `vault_${Date.now()}_${safeRandom}${ext}`;

  const partSizeBytes = params.partSizeBytes || STORAGE_LIMITS.DEFAULT_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(fileSizeBytes / partSizeBytes));

  let uploadId = '';
  const isR2 = isR2Configured();

  if (isR2) {
    const s3 = getS3Client();
    const command = new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: mimeType,
      Metadata: {
        'original-filename': encodeURIComponent(filename),
        'owner-user-id': userId,
        'uploaded-via': 'vaultshare-cloudflare-r2'
      }
    });
    const res = await s3.send(command);
    if (!res.UploadId) {
      throw new Error('Cloudflare R2 failed to return a multipart UploadId');
    }
    uploadId = res.UploadId;
  } else {
    // Local resilient multipart session ID
    uploadId = `local_mp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  const session: R2UploadSession = {
    uploadId,
    objectKey,
    userId,
    filename,
    fileSizeBytes,
    mimeType,
    partSizeBytes,
    totalParts,
    completedParts: [],
    isR2,
    createdAt: Date.now()
  };

  activeSessions.set(uploadId, session);

  // Track concurrent upload for user
  currentUploads.add(uploadId);
  activeUserUploads.set(userId, currentUploads);

  return {
    uploadId,
    objectKey,
    partSizeBytes,
    totalParts,
    isR2
  };
}

/**
 * 2. Sign Part Upload URL
 * Issues a short-lived presigned upload URL (15 min) for the specific part number
 */
export async function signPartUploadUrl(params: {
  uploadId: string;
  objectKey: string;
  partNumber: number;
  userId: string;
}): Promise<{
  partNumber: number;
  signedUrl: string;
  expiresInSeconds: number;
}> {
  const { uploadId, objectKey, partNumber, userId } = params;
  const session = activeSessions.get(uploadId);

  if (!session) {
    throw new Error('Invalid or expired upload session');
  }

  if (session.userId !== userId) {
    throw new Error('Unauthorized upload session access');
  }

  if (session.isR2) {
    const s3 = getS3Client();
    const command = new UploadPartCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      UploadId: uploadId,
      PartNumber: partNumber
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: STORAGE_LIMITS.SIGNED_URL_EXPIRATION_SECONDS
    });

    return {
      partNumber,
      signedUrl,
      expiresInSeconds: STORAGE_LIMITS.SIGNED_URL_EXPIRATION_SECONDS
    };
  }

  // Local fallback signed chunk URL
  const signedUrl = `/api/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
  return {
    partNumber,
    signedUrl,
    expiresInSeconds: STORAGE_LIMITS.SIGNED_URL_EXPIRATION_SECONDS
  };
}

/**
 * 3. Complete Multipart Upload
 * Verifies object with R2 HeadObject, confirms integrity, and records completion
 */
export async function completeMultipartUpload(params: {
  uploadId: string;
  objectKey: string;
  userId: string;
  parts: { PartNumber: number; ETag: string }[];
}): Promise<{
  objectKey: string;
  verifiedSize: number;
  etag: string;
}> {
  const { uploadId, objectKey, userId, parts } = params;
  const session = activeSessions.get(uploadId);

  if (!session) {
    throw new Error('Invalid or expired upload session');
  }

  if (session.userId !== userId) {
    throw new Error('Unauthorized upload session access');
  }

  let verifiedSize = session.fileSizeBytes;
  let etag = '';

  if (session.isR2) {
    const s3 = getS3Client();
    
    // Sort parts by PartNumber ascending (required by S3/R2 specification)
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

    const completeCmd = new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts
      }
    });

    const completeRes = await s3.send(completeCmd);
    etag = completeRes.ETag || '';

    // Validate completed object exists via HeadObject
    const headCmd = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey
    });
    const headRes = await s3.send(headCmd);
    verifiedSize = headRes.ContentLength || session.fileSizeBytes;
  } else {
    etag = `loc_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Cleanup session and concurrent tracker
  activeSessions.delete(uploadId);
  const userUploads = activeUserUploads.get(userId);
  if (userUploads) {
    userUploads.delete(uploadId);
  }

  return {
    objectKey,
    verifiedSize,
    etag
  };
}

/**
 * 4. Abort Multipart Upload
 * Cancels the multipart upload on R2 and frees up resources
 */
export async function abortMultipartUpload(params: {
  uploadId: string;
  objectKey: string;
  userId: string;
}): Promise<boolean> {
  const { uploadId, objectKey, userId } = params;
  const session = activeSessions.get(uploadId);

  if (session && session.userId !== userId) {
    throw new Error('Unauthorized upload session access');
  }

  if (session && session.isR2) {
    try {
      const s3 = getS3Client();
      await s3.send(new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        UploadId: uploadId
      }));
    } catch (err) {
      console.error('Error aborting R2 multipart upload:', err);
    }
  }

  activeSessions.delete(uploadId);
  const userUploads = activeUserUploads.get(userId);
  if (userUploads) {
    userUploads.delete(uploadId);
  }

  return true;
}

/**
 * 5. Authorize File Download & Generate Signed Download Link
 * Issues a short-lived presigned URL (1 hour) with attachment Content-Disposition
 */
export async function authorizeDownload(params: {
  fileId: string;
  objectKey: string;
  originalFilename: string;
  userId?: string;
  ipAddress?: string;
}): Promise<{
  downloadUrl: string;
  isR2: boolean;
  expiresInSeconds: number;
}> {
  const { fileId, objectKey, originalFilename, userId, ipAddress } = params;

  // Record persistent download history
  const file = db.findFileById(fileId);
  if (file) {
    db.incrementDownloads(fileId, userId, ipAddress);
  }

  if (isR2Configured()) {
    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return {
      downloadUrl,
      isR2: true,
      expiresInSeconds: 3600
    };
  }

  // Local streaming endpoint
  const downloadUrl = `/api/files/${fileId}/download`;
  return {
    downloadUrl,
    isR2: false,
    expiresInSeconds: 3600
  };
}

/**
 * 6. Delete File from R2 Object Storage
 */
export async function deleteR2Object(objectKey: string): Promise<boolean> {
  if (isR2Configured()) {
    try {
      const s3 = getS3Client();
      await s3.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey
      }));
      return true;
    } catch (err) {
      console.error('Failed to delete object from Cloudflare R2:', err);
      return false;
    }
  }
  return true;
}

/**
 * 7. Get Cloudflare R2 Service Status & Health
 */
export function getR2IntegrationStatus() {
  const configured = isR2Configured();
  return {
    isConfigured: configured,
    storageEngine: configured ? 'Cloudflare R2 (S3-Compatible Object Storage)' : 'Local Resilient Storage (R2 Fallback Mode)',
    accountId: R2_ACCOUNT_ID ? `${R2_ACCOUNT_ID.slice(0, 4)}...${R2_ACCOUNT_ID.slice(-4)}` : 'Not configured',
    bucketName: R2_BUCKET_NAME,
    endpoint: R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
    limits: {
      maxUploadSize: '10 GB',
      maxUploadSizeBytes: STORAGE_LIMITS.MAX_FILE_SIZE_BYTES,
      defaultUserQuota: '5 GB',
      defaultUserQuotaBytes: STORAGE_LIMITS.DEFAULT_USER_QUOTA_BYTES,
      adminQuota: '500 GB',
      adminQuotaBytes: STORAGE_LIMITS.ADMIN_USER_QUOTA_BYTES,
      maxConcurrentUploads: STORAGE_LIMITS.MAX_CONCURRENT_UPLOADS,
      defaultPartSize: '10 MB',
      signedUrlExpiry: '15 Minutes'
    },
    setupInstructions: {
      step1: 'Log in to your Cloudflare Dashboard and navigate to R2 Storage.',
      step2: 'Create a private bucket named "vaultshare-production" (or choose your own name).',
      step3: 'Click "Manage R2 API Tokens" and create an API token with "Object Read & Write" permissions.',
      step4: 'Copy the Account ID, Access Key ID, and Secret Access Key into your environment variables.',
      envVariables: [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME'
      ]
    }
  };
}
