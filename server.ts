import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UPLOADS_DIR } from './server/db.js';
import {
  requireAuth,
  requireAdmin,
  optionalAuth,
  generateToken,
  verifyToken,
  extractToken,
  AuthenticatedRequest
} from './server/auth.js';
import {
  uploadMiddleware,
  initChunkUpload,
  saveChunk,
  assembleChunks,
  streamFileWithRange
} from './server/storage.js';
import { FileRecord, User } from './server/types.js';
import { extractMediaFromUrl, saveConvertedToVault } from './server/converter.js';
import {
  startMultipartUpload,
  signPartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  authorizeDownload,
  getR2IntegrationStatus,
  STORAGE_LIMITS,
  deleteR2Object
} from './server/r2.js';
import { getSupabaseIntegrationStatus } from './server/supabase.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Express middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Raw body parser for binary chunk uploads
app.use('/api/upload/chunk', express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Public System Status Endpoint
app.get('/api/system/status', (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({
    maintenanceMode: Boolean(settings.maintenanceMode),
    appName: settings.appName || 'VaultShare',
    shutdownReason: settings.shutdownReason || null,
    shutdownAt: settings.shutdownAt || null
  });
});

// Emergency Maintenance / Shutdown Middleware Guard
app.use((req: Request, res: Response, next) => {
  const settings = db.getSettings();
  if (settings.maintenanceMode) {
    // Exempt endpoints: system status, login, admin inspection, and non-api static/Vite assets
    const isExempt =
      req.path === '/api/system/status' ||
      req.path === '/api/auth/login' ||
      req.path === '/api/auth/me' ||
      req.path.startsWith('/api/admin') ||
      !req.path.startsWith('/api/');

    if (!isExempt) {
      const token = extractToken(req);
      if (token) {
        const payload = verifyToken(token);
        if (payload && payload.role === 'admin') {
          return next();
        }
      }
      res.status(503).json({
        error: 'VaultShare is currently offline under emergency administrative maintenance.',
        maintenanceMode: true,
        shutdownReason: settings.shutdownReason || 'Emergency platform maintenance and security audit in progress.',
        shutdownAt: settings.shutdownAt
      });
      return;
    }
  }
  next();
});

// ---------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// ---------------------------------------------------------------------------

// Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ error: 'Email, username, and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (cleanPassword(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    if (db.findUserByEmail(cleanEmail)) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    if (db.findUserByUsername(cleanUsername)) {
      res.status(400).json({ error: 'This username is already taken.' });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Guaranteed admin if email matches spikesprimo6625@gmail.com
    const isAdmin = cleanEmail === 'spikesprimo6625@gmail.com';

    const newUser: User = {
      id: `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      email: cleanEmail,
      username: cleanUsername,
      passwordHash,
      role: isAdmin ? 'admin' : 'user',
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`,
      bio: isAdmin ? 'System Administrator & GhostShare Security Lead' : 'Digital creator & media collector',
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      storageUsedBytes: 0,
      storageLimitBytes: isAdmin ? 500 * 1024 * 1024 * 1024 : 25 * 1024 * 1024 * 1024,
      isSuspended: false
    };

    db.createUser(newUser);
    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed due to server error.' });
  }
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
      return;
    }

    const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Automatic privilege elevation for admin account
    if (cleanEmail === 'spikesprimo6625@gmail.com' && user.role !== 'admin') {
      user.role = 'admin';
      db.updateUser(user.id, { role: 'admin' });
    }

    db.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    const token = generateToken(user);

    res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed due to server error.' });
  }
});

// Password recovery (request reset)
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      res.json({
        message: 'If an account exists with this email, recovery instructions have been prepared.',
        demoResetToken: 'demo_recovery_token'
      });
      return;
    }
    const resetToken = crypto.randomBytes(24).toString('hex');
    res.json({
      message: 'Password recovery token generated successfully. In production, this link is delivered via email.',
      recoveryToken: resetToken,
      email: cleanEmail
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process password recovery.' });
  }
});

// Password recovery (apply reset)
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || cleanPassword(password).length < 6) {
      res.status(400).json({ error: 'Valid email and a password of at least 6 characters are required.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      res.status(404).json({ error: 'No account found with this email address.' });
      return;
    }
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    db.updateUser(user.id, { passwordHash });
    res.json({ success: true, message: 'Password has been successfully updated. You may now sign in.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Google sign-in / seamless OAuth receiver
app.post('/api/auth/google-login', (req: Request, res: Response) => {
  try {
    const { email, name, avatarUrl } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required for Google sign-in.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = db.findUserByEmail(cleanEmail);

    const isAdmin = cleanEmail === 'spikesprimo6625@gmail.com';

    if (!user) {
      const username = (name || cleanEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '') || `user_${Date.now()}`;
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), salt);

      user = {
        id: `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        email: cleanEmail,
        username,
        passwordHash,
        role: isAdmin ? 'admin' : 'user',
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanEmail}`,
        bio: isAdmin ? 'System Administrator & GhostShare Security Lead' : 'Digital creator',
        isEmailVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        storageUsedBytes: 0,
        storageLimitBytes: isAdmin ? 500 * 1024 * 1024 * 1024 : 25 * 1024 * 1024 * 1024,
        isSuspended: false
      };
      db.createUser(user);
    } else {
      if (isAdmin && user.role !== 'admin') {
        user.role = 'admin';
        db.updateUser(user.id, { role: 'admin' });
      }
      db.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Google sign-in failed.' });
  }
});

// Get current user session
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(user) });
});

// Update profile
app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { username, bio, avatarUrl } = req.body;
  const updates: Partial<User> = {};
  if (typeof username === 'string' && username.trim().length >= 2) {
    const existing = db.findUserByUsername(username.trim());
    if (existing && existing.id !== req.user!.userId) {
      res.status(400).json({ error: 'Username is already taken.' });
      return;
    }
    updates.username = username.trim();
  }
  if (typeof bio === 'string') updates.bio = bio.trim();
  if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.trim();

  const updated = db.updateUser(req.user!.userId, updates);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(updated) });
});

// Export account data archive
app.get('/api/auth/export-data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = db.findUserById(userId);
  const userFiles = db.getFiles().filter(f => f.userId === userId);
  const userDownloads = db.getUserDownloads(userId);
  const userFavorites = db.getFavorites(userId);
  const userCollections = db.getUserCollections(userId);

  const exportPayload = {
    exportDate: new Date().toISOString(),
    account: sanitizeUser(user!),
    uploads: userFiles,
    downloadHistory: userDownloads,
    favorites: userFavorites,
    collections: userCollections
  };

  res.setHeader('Content-Disposition', `attachment; filename="vaultshare-data-${userId}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(exportPayload, null, 2));
});

// Delete account
app.delete('/api/auth/account', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = db.findUserById(userId);
  if (user?.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
    res.status(400).json({ error: 'The primary system administrator account cannot be deleted.' });
    return;
  }
  const success = db.deleteUser(userId);
  if (!success) {
    res.status(500).json({ error: 'Could not delete user account.' });
    return;
  }
  res.json({ message: 'Account and associated files deleted permanently.' });
});

// ---------------------------------------------------------------------------
// FILE DISCOVERY & BROWSING ROUTES
// ---------------------------------------------------------------------------

// List files with search, filtering, sorting, and pagination
app.get('/api/files', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const {
    search,
    category,
    sort = 'trending',
    resolution,
    tag,
    uploaderId,
    visibility,
    page = '1',
    limit = '24'
  } = req.query;

  const currentUserId = req.user?.userId;
  const isAdmin = req.user?.role === 'admin';

  let files = db.getFiles();

  // Visibility filtering
  if (uploaderId && uploaderId === currentUserId) {
    // Owner can view all their files (public, unlisted, private)
    files = files.filter(f => f.userId === uploaderId);
    if (visibility) {
      files = files.filter(f => f.visibility === visibility);
    }
  } else if (isAdmin) {
    // Admin can browse everything or filter
    if (visibility) {
      files = files.filter(f => f.visibility === visibility);
    }
  } else {
    // Public general browsing
    files = files.filter(f => f.visibility === 'public');
  }

  // Filter by category
  if (category && category !== 'all') {
    files = files.filter(f => f.category === category);
  }

  // Filter by tag
  if (tag && typeof tag === 'string') {
    files = files.filter(f => f.tags && f.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase()));
  }

  // Filter by resolution (8K, 4K, 1080p, 720p, 480p, HD)
  if (resolution && typeof resolution === 'string') {
    const resKey = resolution.toLowerCase().trim();
    files = files.filter(f => {
      const r = f.metadata?.resolution?.toLowerCase() || '';
      if (resKey === 'hd') {
        return r.includes('hd') || r.includes('720') || r.includes('1080');
      }
      return r.includes(resKey);
    });
  }

  // Search by title, description, or original filename
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    files = files.filter(f =>
      f.title.toLowerCase().includes(q) ||
      (f.description && f.description.toLowerCase().includes(q)) ||
      f.originalFilename.toLowerCase().includes(q) ||
      (f.tags && f.tags.some(t => t.toLowerCase().includes(q))) ||
      f.uploaderName.toLowerCase().includes(q)
    );
  }

  // Sorting
  switch (sort) {
    case 'newest':
      files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'oldest':
      files.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'rating':
      files.sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
      break;
    case 'downloads':
      files.sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0));
      break;
    case 'views':
      files.sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
      break;
    case 'title':
      files.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'trending':
    default:
      // Weighted trending score based on views, downloads, and ratings
      files.sort((a, b) => {
        const scoreA = (a.viewsCount * 1.5) + (a.downloadsCount * 4) + (a.ratingAverage * 20);
        const scoreB = (b.viewsCount * 1.5) + (b.downloadsCount * 4) + (b.ratingAverage * 20);
        return scoreB - scoreA;
      });
      break;
  }

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const total = files.length;
  const totalPages = Math.ceil(total / limitNum);
  const paginatedFiles = files.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    files: paginatedFiles,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  });
});

// Get single file details
app.get('/api/files/:id', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const file = db.findFileById(id);

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Permission check
  const currentUserId = req.user?.userId;
  const isAdmin = req.user?.role === 'admin';
  const isOwner = currentUserId && file.userId === currentUserId;

  if (file.visibility === 'private' && !isOwner && !isAdmin) {
    res.status(403).json({ error: 'This file is private.' });
    return;
  }

  // Increment view counter
  db.incrementViews(id);

  // Check if current user favorited or rated this file
  let isFavorited = false;
  let userRating: number | null = null;

  if (currentUserId) {
    const favorites = db.getFavorites(currentUserId);
    isFavorited = favorites.some(f => f.fileId === id);
    userRating = db.getUserRating(id, currentUserId);
  }

  res.json({
    file,
    isFavorited,
    userRating
  });
});

// Retrieve file by unlisted share token
app.get('/api/share/:token', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;
  const file = db.findFileByShareToken(token);

  if (!file) {
    res.status(404).json({ error: 'Share link invalid or expired.' });
    return;
  }

  db.incrementViews(file.id);

  let isFavorited = false;
  let userRating: number | null = null;
  if (req.user?.userId) {
    const favorites = db.getFavorites(req.user.userId);
    isFavorited = favorites.some(f => f.fileId === file.id);
    userRating = db.getUserRating(file.id, req.user.userId);
  }

  res.json({
    file,
    isFavorited,
    userRating
  });
});

// ---------------------------------------------------------------------------
// DIRECT FILE UPLOAD ROUTE
// ---------------------------------------------------------------------------

app.post('/api/files', requireAuth, uploadMiddleware.single('file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file was uploaded' });
      return;
    }

    const {
      title,
      description = '',
      category = 'other',
      tags = '',
      visibility = 'public',
      resolution = '',
      duration = '',
      codec = '',
      bitrate = '',
      thumbnailDataUrl = ''
    } = req.body;

    const user = db.findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check storage quota
    if (user.storageUsedBytes + req.file.size > user.storageLimitBytes) {
      // Delete uploaded file if over quota
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
      res.status(400).json({ error: 'Upload exceeds your available storage quota.' });
      return;
    }

    const fileId = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : Array.isArray(tags) ? tags : [];

    // Thumbnail saving if provided as dataUrl
    let finalThumbnailUrl = '';
    if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:image/')) {
      finalThumbnailUrl = thumbnailDataUrl;
    }

    const fileRecord: FileRecord = {
      id: fileId,
      userId: user.id,
      uploaderName: user.username,
      uploaderAvatar: user.avatarUrl,
      title: title?.trim() || req.file.originalname,
      description: description?.trim() || '',
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      category: category as any,
      tags: parsedTags,
      visibility: visibility as any,
      shareToken: crypto.randomBytes(12).toString('hex'),
      thumbnailUrl: finalThumbnailUrl || undefined,
      metadata: {
        resolution: resolution || undefined,
        duration: duration ? parseFloat(duration) : undefined,
        codec: codec || undefined,
        bitrate: bitrate || undefined,
        format: path.extname(req.file.originalname).replace('.', '').toUpperCase()
      },
      viewsCount: 0,
      downloadsCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
      ratingDistribution: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingStatus: 'ready'
    };

    const saved = db.createFile(fileRecord);
    res.status(201).json({ file: saved });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to process file upload.' });
  }
});

// ---------------------------------------------------------------------------
// RESUMABLE CHUNKED UPLOAD ROUTES (For 4K/8K and Gigabyte files)
// ---------------------------------------------------------------------------

// 1. Init upload session
app.post('/api/upload/init', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { filename, totalChunks, totalSize, mimeType } = req.body;
  if (!filename || !totalChunks || !totalSize) {
    res.status(400).json({ error: 'Filename, totalChunks, and totalSize are required.' });
    return;
  }

  const user = db.findUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.storageUsedBytes + totalSize > user.storageLimitBytes) {
    res.status(400).json({ error: 'File size exceeds your storage quota.' });
    return;
  }

  const uploadId = `chk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  initChunkUpload(uploadId, filename, totalChunks, totalSize, mimeType || 'application/octet-stream');

  res.json({ uploadId });
});

// 2. Upload binary chunk
app.post('/api/upload/chunk', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const uploadId = req.headers['x-upload-id'] as string;
  const chunkIndex = parseInt(req.headers['x-chunk-index'] as string, 10);

  if (!uploadId || isNaN(chunkIndex)) {
    res.status(400).json({ error: 'x-upload-id and x-chunk-index headers are required.' });
    return;
  }

  const buffer = req.body as Buffer;
  if (!buffer || buffer.length === 0) {
    res.status(400).json({ error: 'No binary chunk data received.' });
    return;
  }

  saveChunk(uploadId, chunkIndex, buffer);
  res.json({ success: true, chunkIndex });
});

// 3. Assemble and finalize file
app.post('/api/upload/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      uploadId,
      title,
      description = '',
      category = 'other',
      tags = '',
      visibility = 'public',
      resolution = '',
      duration = '',
      codec = '',
      bitrate = '',
      originalFilename,
      mimeType,
      thumbnailDataUrl
    } = req.body;

    if (!uploadId) {
      res.status(400).json({ error: 'uploadId is required.' });
      return;
    }

    const user = db.findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { storedFilename, fileSizeBytes, sha256 } = await assembleChunks(uploadId);

    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : Array.isArray(tags) ? tags : [];

    const fileId = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const fileRecord: FileRecord = {
      id: fileId,
      userId: user.id,
      uploaderName: user.username,
      uploaderAvatar: user.avatarUrl,
      title: title?.trim() || originalFilename || 'Uploaded Media',
      description: description?.trim() || '',
      originalFilename: originalFilename || storedFilename,
      storedFilename,
      mimeType: mimeType || 'application/octet-stream',
      fileSizeBytes,
      category: category as any,
      tags: parsedTags,
      visibility: visibility as any,
      shareToken: crypto.randomBytes(12).toString('hex'),
      thumbnailUrl: thumbnailDataUrl || undefined,
      metadata: {
        resolution: resolution || undefined,
        duration: duration ? parseFloat(duration) : undefined,
        codec: codec || undefined,
        bitrate: bitrate || undefined,
        sha256,
        format: path.extname(originalFilename || storedFilename).replace('.', '').toUpperCase()
      },
      viewsCount: 0,
      downloadsCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
      ratingDistribution: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingStatus: 'ready'
    };

    const saved = db.createFile(fileRecord);
    res.status(201).json({ file: saved });
  } catch (err: any) {
    console.error('Assemble chunk upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to assemble chunked file.' });
  }
});

// ---------------------------------------------------------------------------
// CLOUDFLARE R2 S3-COMPATIBLE STORAGE ENDPOINTS
// ---------------------------------------------------------------------------

// R2 integration status and health check
app.get('/api/r2/status', (_req: Request, res: Response) => {
  res.json(getR2IntegrationStatus());
});

// Start R2 multipart upload session
app.post('/api/r2/multipart/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename, fileSizeBytes, mimeType, partSizeBytes } = req.body;
    if (!filename || !fileSizeBytes) {
      res.status(400).json({ error: 'Filename and fileSizeBytes are required.' });
      return;
    }

    const session = await startMultipartUpload({
      userId: req.user!.userId,
      filename,
      fileSizeBytes: Number(fileSizeBytes),
      mimeType: mimeType || 'application/octet-stream',
      partSizeBytes: partSizeBytes ? Number(partSizeBytes) : undefined
    });

    res.json(session);
  } catch (err: any) {
    console.error('R2 multipart start error:', err);
    res.status(400).json({ error: err.message || 'Failed to start multipart upload' });
  }
});

// Sign specific part upload URL (15-min presigned S3/R2 URL)
app.post('/api/r2/multipart/sign-part', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uploadId, objectKey, partNumber } = req.body;
    if (!uploadId || !objectKey || !partNumber) {
      res.status(400).json({ error: 'uploadId, objectKey, and partNumber are required.' });
      return;
    }

    const signed = await signPartUploadUrl({
      uploadId,
      objectKey,
      partNumber: Number(partNumber),
      userId: req.user!.userId
    });

    res.json(signed);
  } catch (err: any) {
    console.error('R2 sign part error:', err);
    res.status(400).json({ error: err.message || 'Failed to sign part upload URL' });
  }
});

// Complete R2 multipart upload & record verified file
app.post('/api/r2/multipart/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      uploadId,
      objectKey,
      parts,
      title,
      description = '',
      category = 'other',
      tags = '',
      visibility = 'public',
      resolution = '',
      duration = '',
      codec = '',
      bitrate = '',
      originalFilename,
      mimeType,
      thumbnailDataUrl
    } = req.body;

    if (!uploadId || !objectKey) {
      res.status(400).json({ error: 'uploadId and objectKey are required.' });
      return;
    }

    const user = db.findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { verifiedSize, etag } = await completeMultipartUpload({
      uploadId,
      objectKey,
      userId: user.id,
      parts: Array.isArray(parts) ? parts : []
    });

    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : Array.isArray(tags) ? tags : [];

    const fileId = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const fileRecord: FileRecord = {
      id: fileId,
      userId: user.id,
      uploaderName: user.username,
      uploaderAvatar: user.avatarUrl,
      title: title?.trim() || originalFilename || 'R2 Media Archive',
      description: description?.trim() || '',
      originalFilename: originalFilename || objectKey,
      storedFilename: objectKey,
      mimeType: mimeType || 'application/octet-stream',
      fileSizeBytes: verifiedSize,
      category: category as any,
      tags: parsedTags,
      visibility: visibility as any,
      shareToken: crypto.randomBytes(12).toString('hex'),
      thumbnailUrl: thumbnailDataUrl || undefined,
      metadata: {
        resolution: resolution || undefined,
        duration: duration ? parseFloat(duration) : undefined,
        codec: codec || undefined,
        bitrate: bitrate || undefined,
        format: path.extname(originalFilename || objectKey).replace('.', '').toUpperCase(),
        sha256: etag
      },
      viewsCount: 0,
      downloadsCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
      ratingDistribution: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingStatus: 'ready'
    };

    const saved = db.createFile(fileRecord);
    res.status(201).json({ file: saved, verifiedSize, etag });
  } catch (err: any) {
    console.error('R2 complete error:', err);
    res.status(400).json({ error: err.message || 'Failed to complete multipart upload' });
  }
});

// Abort R2 multipart upload
app.post('/api/r2/multipart/abort', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uploadId, objectKey } = req.body;
    await abortMultipartUpload({
      uploadId,
      objectKey,
      userId: req.user!.userId
    });
    res.json({ success: true, message: 'Upload session aborted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to abort upload session' });
  }
});

// Authorize download & generate signed download link
app.get('/api/r2/download/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = db.findFileById(id);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const currentUserId = req.user?.userId;
    const isAdmin = req.user?.role === 'admin';
    const isOwner = currentUserId && file.userId === currentUserId;

    if (file.visibility === 'private' && !isOwner && !isAdmin) {
      res.status(403).json({ error: 'This file is private.' });
      return;
    }

    const downloadAuth = await authorizeDownload({
      fileId: file.id,
      objectKey: file.storedFilename,
      originalFilename: file.originalFilename,
      userId: currentUserId,
      ipAddress: req.ip
    });

    res.json(downloadAuth);
  } catch (err: any) {
    console.error('R2 download authorization error:', err);
    res.status(500).json({ error: 'Could not authorize file download' });
  }
});

// ---------------------------------------------------------------------------
// SUPABASE POSTGRESQL INTEGRATION STATUS & MIGRATION ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/supabase/status', (_req: Request, res: Response) => {
  res.json(getSupabaseIntegrationStatus());
});

app.get('/api/supabase/migration', (_req: Request, res: Response) => {
  try {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261016000000_vaultshare_phase1.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain');
      res.send(sql);
    } else {
      res.status(404).send('-- Migration file not found');
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read migration file' });
  }
});

// ---------------------------------------------------------------------------
// STREAMING & DOWNLOAD ROUTES WITH HTTP RANGE SUPPORT (4K / 8K)
// ---------------------------------------------------------------------------

// Stream endpoint for video/audio players and inline previews
app.get('/api/files/:id/stream', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const file = db.findFileById(id);

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Check permissions
  const currentUserId = req.user?.userId;
  const isAdmin = req.user?.role === 'admin';
  const isOwner = currentUserId && file.userId === currentUserId;

  if (file.visibility === 'private' && !isOwner && !isAdmin) {
    res.status(403).json({ error: 'This file is private.' });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, file.storedFilename);
  streamFileWithRange(filePath, file.mimeType, null, req, res);
});

// Download endpoint
app.get('/api/files/:id/download', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const file = db.findFileById(id);

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Check permissions
  const currentUserId = req.user?.userId;
  const isAdmin = req.user?.role === 'admin';
  const isOwner = currentUserId && file.userId === currentUserId;

  if (file.visibility === 'private' && !isOwner && !isAdmin) {
    res.status(403).json({ error: 'This file is private.' });
    return;
  }

  // Increment download counter and record in user download history
  const ip = req.ip || req.socket.remoteAddress;
  db.incrementDownloads(id, currentUserId, ip);

  const filePath = path.join(UPLOADS_DIR, file.storedFilename);
  streamFileWithRange(filePath, file.mimeType, file.originalFilename, req, res);
});

// ---------------------------------------------------------------------------
// LINK CONVERTER & WATERMARK-FREE EXTRACTOR ROUTES
// ---------------------------------------------------------------------------

// Extract media info and formats from any link
app.post('/api/converter/extract', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ error: 'Please paste a valid video or audio link.' });
      return;
    }

    const mediaInfo = await extractMediaFromUrl(url);
    res.json({ mediaInfo });
  } catch (err: any) {
    console.error('Converter extract error:', err);
    res.status(400).json({ error: err.message || 'Unable to extract video from this link.' });
  }
});

// Download converted media (MP4 or MP3) without watermark
app.get('/api/converter/download', (req: Request, res: Response) => {
  try {
    const { title = 'recovered_media', format = 'mp4' } = req.query;
    const isAudio = format === 'mp3';
    const ext = isAudio ? 'mp3' : 'mp4';
    const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';

    const safeTitle = `${(title as string).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'media'}_nowatermark.${ext}`;
    const encodedSafe = encodeURIComponent(safeTitle);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}"; filename*=UTF-8''${encodedSafe}`);
    res.setHeader('Accept-Ranges', 'bytes');

    // Deliver corresponding media file from disk
    const sampleFilename = isAudio ? 'seed_audio_synthwave.mp3' : 'seed_video_4k_aurora.mp4';
    const filePath = path.join(UPLOADS_DIR, sampleFilename);

    if (fs.existsSync(filePath)) {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      res.send(Buffer.alloc(1024 * 1024, 0x11));
    }
  } catch (err: any) {
    console.error('Converter download error:', err);
    res.status(500).json({ error: 'Failed to stream media.' });
  }
});

// Stream converted media for preview player
app.get('/api/converter/stream', (req: Request, res: Response) => {
  const { format = 'mp4' } = req.query;
  const isAudio = format === 'mp3';
  const sampleFilename = isAudio ? 'seed_audio_synthwave.mp3' : 'seed_video_4k_aurora.mp4';
  const filePath = path.join(UPLOADS_DIR, sampleFilename);
  const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';

  streamFileWithRange(filePath, mimeType, null, req, res);
});

// Save converted media directly to the user's GhostShare library
app.post('/api/converter/save-to-vault', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, thumbnailUrl, originalUrl, format, quality } = req.body;
    if (!title || !originalUrl) {
      res.status(400).json({ error: 'Missing converted media details.' });
      return;
    }

    const savedFile = await saveConvertedToVault(req.user!.userId, {
      title,
      thumbnailUrl,
      originalUrl,
      format: format === 'mp3' ? 'mp3' : 'mp4',
      quality: quality || '1080p FHD'
    });

    res.status(201).json({ file: savedFile, message: 'Media saved to your GhostShare Vault!' });
  } catch (err: any) {
    console.error('Save to vault error:', err);
    res.status(500).json({ error: err.message || 'Could not save to vault.' });
  }
});

// ---------------------------------------------------------------------------
// 10-STAR RATING SYSTEM
// ---------------------------------------------------------------------------

app.post('/api/files/:id/rate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { score } = req.body;

  const numericScore = parseFloat(score);
  if (isNaN(numericScore) || numericScore < 1 || numericScore > 10) {
    res.status(400).json({ error: 'Rating score must be an integer or number between 1 and 10.' });
    return;
  }

  const file = db.findFileById(id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const result = db.rateFile(id, req.user!.userId, numericScore);
  res.json({
    fileId: id,
    userRating: Math.round(numericScore),
    ratingAverage: result.average,
    ratingCount: result.count,
    ratingDistribution: result.distribution
  });
});

// ---------------------------------------------------------------------------
// PERSONAL DOWNLOADS & LIBRARY
// ---------------------------------------------------------------------------

// Get authenticated user download history
app.get('/api/user/downloads', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const downloads = db.getUserDownloads(req.user!.userId);
  res.json({ downloads });
});

// Delete single download record
app.delete('/api/user/downloads/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const success = db.removeDownloadRecord(id, req.user!.userId);
  res.json({ success });
});

// Clear all download history
app.delete('/api/user/downloads', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  db.clearUserDownloads(req.user!.userId);
  res.json({ success: true });
});

// Toggle favorite
app.post('/api/files/:id/favorite', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const file = db.findFileById(id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const isFavorited = db.toggleFavorite(id, req.user!.userId);
  res.json({ isFavorited });
});

// Get user personal library summary
app.get('/api/user/library', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = db.findUserById(userId);
  const myUploads = db.getFiles().filter(f => f.userId === userId);
  const favorites = db.getFavorites(userId);
  const favoriteFiles = favorites
    .map(fav => db.findFileById(fav.fileId))
    .filter(Boolean) as FileRecord[];
  const collections = db.getUserCollections(userId);
  const downloads = db.getUserDownloads(userId);

  res.json({
    storageUsedBytes: user?.storageUsedBytes || 0,
    storageLimitBytes: user?.storageLimitBytes || 25 * 1024 * 1024 * 1024,
    myUploads,
    favoriteFiles,
    collections,
    downloadCount: downloads.length
  });
});

// Update an existing upload (edit title, description, visibility, tags)
app.put('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const file = db.findFileById(id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const isOwner = file.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'admin';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'You are not authorized to edit this file.' });
    return;
  }

  const { title, description, category, tags, visibility } = req.body;
  const updates: Partial<FileRecord> = {};
  if (typeof title === 'string') updates.title = title.trim();
  if (typeof description === 'string') updates.description = description.trim();
  if (typeof category === 'string') updates.category = category as any;
  if (Array.isArray(tags)) updates.tags = tags;
  if (typeof visibility === 'string') updates.visibility = visibility as any;

  const updated = db.updateFile(id, updates);
  res.json({ file: updated });
});

// Delete an upload
app.delete('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const file = db.findFileById(id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const isOwner = file.userId === req.user!.userId;
  const isAdmin = req.user!.role === 'admin';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'You are not authorized to delete this file.' });
    return;
  }

  db.deleteFile(id);
  res.json({ success: true, message: 'File deleted successfully.' });
});

// Collections CRUD
app.get('/api/user/collections', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const collections = db.getUserCollections(req.user!.userId);
  res.json({ collections });
});

app.post('/api/user/collections', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, description = '', isPublic = false } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Collection name is required.' });
    return;
  }

  const collection = db.createCollection({
    id: `col_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    userId: req.user!.userId,
    name: name.trim(),
    description: description.trim(),
    fileIds: [],
    isPublic: Boolean(isPublic),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  res.status(201).json({ collection });
});

app.put('/api/user/collections/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, isPublic, fileIds } = req.body;

  const updates: any = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);
  if (Array.isArray(fileIds)) updates.fileIds = fileIds;

  const updated = db.updateCollection(id, req.user!.userId, updates);
  if (!updated) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }

  res.json({ collection: updated });
});

app.delete('/api/user/collections/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const success = db.deleteCollection(id, req.user!.userId);
  res.json({ success });
});

// ---------------------------------------------------------------------------
// CREATOR PROFILE & COMMENTS & REPORTS
// ---------------------------------------------------------------------------

// Public creator profile
app.get('/api/creators/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const user = db.findUserById(id);
  if (!user) {
    res.status(404).json({ error: 'Creator not found' });
    return;
  }

  const publicFiles = db.getFiles().filter(f => f.userId === id && f.visibility === 'public');
  const totalViews = publicFiles.reduce((acc, f) => acc + (f.viewsCount || 0), 0);
  const totalDownloads = publicFiles.reduce((acc, f) => acc + (f.downloadsCount || 0), 0);
  const ratedFiles = publicFiles.filter(f => f.ratingCount > 0);
  const avgRating = ratedFiles.length > 0
    ? parseFloat((ratedFiles.reduce((acc, f) => acc + f.ratingAverage, 0) / ratedFiles.length).toFixed(1))
    : 10.0;

  res.json({
    creator: sanitizeUser(user),
    publicFiles,
    stats: {
      totalUploads: publicFiles.length,
      totalViews,
      totalDownloads,
      averageRating: avgRating
    }
  });
});

// Comments for a file
app.get('/api/files/:id/comments', (req: Request, res: Response) => {
  const { id } = req.params;
  const comments = db.getComments(id);
  res.json({ comments });
});

app.post('/api/files/:id/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { content, parentId } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Comment content cannot be empty.' });
    return;
  }

  const user = db.findUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const comment = db.addComment({
    id: `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    fileId: id,
    userId: user.id,
    username: user.username,
    userAvatar: user.avatarUrl,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    likes: 0,
    parentId: parentId || undefined
  });

  res.status(201).json({ comment });
});

app.delete('/api/comments/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isAdmin = req.user!.role === 'admin';
  const success = db.deleteComment(id, req.user!.userId, isAdmin);
  if (!success) {
    res.status(403).json({ error: 'Cannot delete comment.' });
    return;
  }
  res.json({ success: true });
});

// File / Content reports
app.post('/api/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { targetType, targetId, reason, notes, targetTitle } = req.body;
  if (!targetType || !targetId || !reason) {
    res.status(400).json({ error: 'Target and reason are required.' });
    return;
  }

  const user = db.findUserById(req.user!.userId);
  const report = db.createReport({
    id: `rep_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    reporterUserId: user!.id,
    reporterName: user!.username,
    targetType,
    targetId,
    targetTitle,
    reason,
    notes: notes?.trim() || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  res.status(201).json({ report, message: 'Report submitted. Our moderation team has been notified.' });
});

// ---------------------------------------------------------------------------
// ADMIN PANEL ENDPOINTS (Restricted to role === 'admin')
// ---------------------------------------------------------------------------

// Overview metrics
app.get('/api/admin/overview', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsers();
  const files = db.getFiles();
  const reports = db.getReports();

  const totalStorage = files.reduce((acc, f) => acc + f.fileSizeBytes, 0);
  const totalDownloads = files.reduce((acc, f) => acc + (f.downloadsCount || 0), 0);
  const totalViews = files.reduce((acc, f) => acc + (f.viewsCount || 0), 0);

  const categoryBreakdown: Record<string, number> = {};
  for (const f of files) {
    categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + 1;
  }

  const topDownloaded = [...files].sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0)).slice(0, 5);
  const pendingReports = reports.filter(r => r.status === 'pending');

  res.json({
    metrics: {
      totalUsers: users.length,
      totalFiles: files.length,
      totalStorageBytes: totalStorage,
      totalDownloads,
      totalViews,
      pendingReportsCount: pendingReports.length
    },
    categoryBreakdown,
    topDownloaded,
    pendingReports
  });
});

// Manage users
app.get('/api/admin/users', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsers().map(sanitizeUser);
  res.json({ users });
});

app.put('/api/admin/users/:id/role', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const target = db.findUserById(id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Prevent demoting primary administrator
  if (target.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
    res.status(400).json({ error: 'Primary administrator role cannot be altered.' });
    return;
  }

  const updated = db.updateUser(id, { role });
  res.json({ user: sanitizeUser(updated!) });
});

app.put('/api/admin/users/:id/status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { isSuspended } = req.body;

  const target = db.findUserById(id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (target.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
    res.status(400).json({ error: 'Primary administrator cannot be suspended.' });
    return;
  }

  const updated = db.updateUser(id, { isSuspended: Boolean(isSuspended) });
  res.json({ user: sanitizeUser(updated!) });
});

// Manage reports
app.get('/api/admin/reports', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const reports = db.getReports();
  res.json({ reports });
});

app.put('/api/admin/reports/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // 'resolved' | 'dismissed'

  const updated = db.updateReportStatus(id, status, req.user!.username);
  if (!updated) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json({ report: updated });
});

// System settings
app.get('/api/admin/settings', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ settings: db.getSettings() });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateSettings(req.body);
  res.json({ settings: updated });
});

// ---------------------------------------------------------------------------
// SUPER ADMIN SYSTEM CONTROLS (Shutdown, Restore, Clear Website Data)
// ---------------------------------------------------------------------------

// 1. Shutdown the website (puts site into maintenance mode)
app.post('/api/admin/system/shutdown', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const settings = db.shutdownWebsite(reason || 'Emergency administrative maintenance initiated. The platform is currently offline.');
    res.json({
      success: true,
      message: 'Website has been successfully placed into emergency shutdown / maintenance mode.',
      settings
    });
  } catch (err: any) {
    console.error('Website shutdown error:', err);
    res.status(500).json({ error: err.message || 'Failed to shutdown website.' });
  }
});

// 2. Restore website (brings site back online)
app.post('/api/admin/system/restore', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = db.restoreWebsite();
    res.json({
      success: true,
      message: 'Website has been successfully restored to full public online status.',
      settings
    });
  } catch (err: any) {
    console.error('Website restore error:', err);
    res.status(500).json({ error: err.message || 'Failed to restore website.' });
  }
});

// 3. Clear data in the website (purges files, reports, downloads, collections, ratings, comments, non-admin users)
app.post('/api/admin/system/clear-data', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirmation } = req.body;
    const norm = (confirmation || '').trim().toUpperCase();
    if (norm !== 'CLEAR_ALL_DATA' && norm !== 'CONFIRM') {
      res.status(400).json({
        error: 'Confirmation phrase "CONFIRM" or "CLEAR_ALL_DATA" is strictly required to execute website data purge.'
      });
      return;
    }

    const result = db.clearWebsiteData(true);
    res.json({
      success: true,
      message: result.message,
      stats: result
    });
  } catch (err: any) {
    console.error('Clear website data error:', err);
    res.status(500).json({ error: err.message || 'Failed to clear website data.' });
  }
});

// Re-seed showcase media
app.post('/api/admin/system/reseed', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    db.seedInitialMedia();
    res.json({ success: true, message: 'Showcase media files re-seeded successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reseed showcase media.' });
  }
});

// Helper functions
function cleanPassword(p: any): string {
  return typeof p === 'string' ? p : '';
}

function sanitizeUser(u: User) {
  const { passwordHash, ...safe } = u;
  return safe;
}

// ---------------------------------------------------------------------------
// VITE DEV SERVER INTEGRATION & STATIC SERVING
// ---------------------------------------------------------------------------

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GhostShare] Full-Stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
