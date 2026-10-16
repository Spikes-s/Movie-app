import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Request, Response } from 'express';
import { UPLOADS_DIR, CHUNKS_DIR } from './db.js';

// Multer storage for direct multipart uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueId = `file_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueId}${ext}`);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024 // 50 GB maximum upload size
  }
});

// Resumable chunk session metadata
interface ChunkSession {
  uploadId: string;
  filename: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  totalSize: number;
  mimeType: string;
  createdAt: number;
}

const activeChunkSessions = new Map<string, ChunkSession>();

export function initChunkUpload(uploadId: string, filename: string, totalChunks: number, totalSize: number, mimeType: string): void {
  const sessionDir = path.join(CHUNKS_DIR, uploadId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  activeChunkSessions.set(uploadId, {
    uploadId,
    filename,
    totalChunks,
    receivedChunks: new Set<number>(),
    totalSize,
    mimeType,
    createdAt: Date.now()
  });
}

export function saveChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): boolean {
  const session = activeChunkSessions.get(uploadId);
  const sessionDir = path.join(CHUNKS_DIR, uploadId);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const chunkPath = path.join(sessionDir, `chunk_${chunkIndex}`);
  fs.writeFileSync(chunkPath, chunkBuffer);

  if (session) {
    session.receivedChunks.add(chunkIndex);
  }

  return true;
}

export async function assembleChunks(uploadId: string): Promise<{ storedFilename: string; finalPath: string; fileSizeBytes: number; sha256: string }> {
  const session = activeChunkSessions.get(uploadId);
  const sessionDir = path.join(CHUNKS_DIR, uploadId);

  if (!fs.existsSync(sessionDir)) {
    throw new Error('Chunk session directory not found');
  }

  const ext = session ? path.extname(session.filename) : '';
  const storedFilename = `resumable_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const finalPath = path.join(UPLOADS_DIR, storedFilename);

  const writeStream = fs.createWriteStream(finalPath);
  const hash = crypto.createHash('sha256');

  const chunkFiles = fs.readdirSync(sessionDir)
    .filter(f => f.startsWith('chunk_'))
    .sort((a, b) => {
      const idxA = parseInt(a.replace('chunk_', ''), 10);
      const idxB = parseInt(b.replace('chunk_', ''), 10);
      return idxA - idxB;
    });

  let totalBytes = 0;

  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(sessionDir, chunkFile);
    const chunkData = fs.readFileSync(chunkPath);
    hash.update(chunkData);
    writeStream.write(chunkData);
    totalBytes += chunkData.length;
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  const sha256 = hash.digest('hex');

  // Clean up chunk files
  try {
    for (const chunkFile of chunkFiles) {
      fs.unlinkSync(path.join(sessionDir, chunkFile));
    }
    fs.rmdirSync(sessionDir);
    activeChunkSessions.delete(uploadId);
  } catch (err) {
    console.warn('Could not remove temporary chunk directory:', err);
  }

  return {
    storedFilename,
    finalPath,
    fileSizeBytes: totalBytes,
    sha256
  };
}

// HTTP Range request streaming for 4K / 8K video, high-res audio, and documents
export function streamFileWithRange(
  filePath: string,
  mimeType: string,
  downloadName: string | null,
  req: Request,
  res: Response
): void {
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on storage server' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Base headers
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');

  if (downloadName) {
    // Sanitize filename for content disposition
    const safeName = encodeURIComponent(downloadName);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${safeName}`);
  }

  if (range) {
    // Parse Range header e.g. "bytes=1000-2000" or "bytes=1000-"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunksize,
      'Content-Type': mimeType || 'application/octet-stream'
    });

    fileStream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
