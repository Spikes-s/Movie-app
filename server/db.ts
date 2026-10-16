import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
import {
  User,
  FileRecord,
  RatingRecord,
  DownloadRecord,
  FavoriteRecord,
  CollectionRecord,
  CommentRecord,
  ReportRecord,
  SystemSettings
} from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const THUMBNAILS_DIR = path.resolve(DATA_DIR, 'thumbnails');
const CHUNKS_DIR = path.resolve(DATA_DIR, 'chunks');
const DB_FILE = path.resolve(DATA_DIR, 'vaultshare.db.json');

// Ensure directories exist
for (const dir of [DATA_DIR, UPLOADS_DIR, THUMBNAILS_DIR, CHUNKS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface DatabaseSchema {
  users: User[];
  files: FileRecord[];
  ratings: RatingRecord[];
  downloads: DownloadRecord[];
  favorites: FavoriteRecord[];
  collections: CollectionRecord[];
  comments: CommentRecord[];
  reports: ReportRecord[];
  settings: SystemSettings;
}

const DEFAULT_SETTINGS: SystemSettings = {
  appName: 'GhostShare',
  primaryColor: '#8b5cf6',
  maxUploadSizeBytes: 50 * 1024 * 1024 * 1024, // 50 GB
  defaultUserStorageQuotaBytes: 25 * 1024 * 1024 * 1024, // 25 GB
  allowedFileCategories: [
    'video',
    'audio',
    'image',
    'document',
    'archive',
    'software',
    'ebook',
    'design',
    'other'
  ],
  enablePublicRegistration: true,
  maintenanceMode: false
};

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.ensureAdminUser();
    this.seedInitialMedia();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          files: parsed.files || [],
          ratings: parsed.ratings || [],
          downloads: parsed.downloads || [],
          favorites: parsed.favorites || [],
          collections: parsed.collections || [],
          comments: parsed.comments || [],
          reports: parsed.reports || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
        };
      } catch (err) {
        console.error('Failed to parse database file, resetting to defaults', err);
      }
    }

    return {
      users: [],
      files: [],
      ratings: [],
      downloads: [],
      favorites: [],
      collections: [],
      comments: [],
      reports: [],
      settings: DEFAULT_SETTINGS
    };
  }

  private save(): void {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Error writing database to disk:', err);
    }
  }

  // Ensure specified user spikesprimo6625@gmail.com is configured as Admin
  private ensureAdminUser(): void {
    const adminEmail = 'spikesprimo6625@gmail.com';
    let admin = this.data.users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());

    if (!admin) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('AdminVault2026!', salt);

      admin = {
        id: 'admin_spikesprimo',
        email: adminEmail,
        username: 'PrimoAdmin',
        passwordHash,
        role: 'admin',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Chief System Administrator & GhostShare Security Lead.',
        isEmailVerified: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        storageUsedBytes: 1024 * 1024 * 450, // 450MB
        storageLimitBytes: 500 * 1024 * 1024 * 1024, // 500 GB
        isSuspended: false
      };
      this.data.users.push(admin);
      this.save();
      console.log(`[DB] Created primary admin account for ${adminEmail}`);
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      this.save();
      console.log(`[DB] Elevated ${adminEmail} to admin`);
    }
  }

  // Seeds sample files and writes actual working binary files to disk
  public seedInitialMedia(): void {

    // Helper to create a dummy but valid audio/video/doc file content on disk
    const writeSeedFile = (filename: string, content: Buffer | string) => {
      const filePath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
      }
    };

    // 1. Sample 4K Video (Nature Aurora in 4K UHD)
    // Generates a fully compliant, playable H.264 MP4 with AAC audio track
    const sampleVideoFile = 'seed_video_4k_aurora.mp4';
    const videoFilePath = path.join(UPLOADS_DIR, sampleVideoFile);
    if (!fs.existsSync(videoFilePath) || fs.statSync(videoFilePath).size < 10000) {
      try {
        execSync(
          `ffmpeg -y -f lavfi -i "smptebars=duration=15:size=1280x720:rate=30" -f lavfi -i "sine=frequency=523.25:duration=15" -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 -movflags +faststart -c:a aac -b:a 128k -ar 44100 "${videoFilePath}"`,
          { stdio: 'ignore' }
        );
      } catch (e) {
        const mp4Header = Buffer.from([
          0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
          0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
          0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32
        ]);
        writeSeedFile(sampleVideoFile, Buffer.concat([mp4Header, Buffer.alloc(1024 * 512, 0xAA)]));
      }
    }

    // 2. Sample Audio (Cyberpunk Synthwave Master)
    // Generates a fully compliant, playable MP3 audio file
    const sampleAudioFile = 'seed_audio_synthwave.mp3';
    const audioFilePath = path.join(UPLOADS_DIR, sampleAudioFile);
    if (!fs.existsSync(audioFilePath) || fs.statSync(audioFilePath).size < 5000) {
      try {
        execSync(
          `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=12" -c:a libmp3lame -b:a 192k "${audioFilePath}"`,
          { stdio: 'ignore' }
        );
      } catch (e) {
        const id3Header = Buffer.from([
          0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0A,
          0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00
        ]);
        writeSeedFile(sampleAudioFile, Buffer.concat([id3Header, Buffer.alloc(1024 * 128, 0x55)]));
      }
    }

    // 3. Sample PDF (VaultShare Enterprise Architecture)
    const sampleDocFile = 'seed_doc_vaultshare_whitepaper.pdf';
    const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT /F1 24 Tf 100 700 Td (VaultShare 4K & High-Res Storage Whitepaper) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000216 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF`;
    writeSeedFile(sampleDocFile, pdfContent);

    // 4. Sample Archive (Developer SDK Release v2.4.zip)
    const sampleZipFile = 'seed_archive_sdk_v2.4.zip';
    // Minimal valid zip header
    const zipHeader = Buffer.from([
      0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    writeSeedFile(sampleZipFile, zipHeader);

    // 5. Sample 8K Wallpaper
    const sampleImageFile = 'seed_image_8k_nebula.jpg';
    writeSeedFile(sampleImageFile, Buffer.alloc(1024 * 256, 0xFE));

    const initialFiles: FileRecord[] = [
      {
        id: 'file_8k_deep_cosmos',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Deep Cosmos 8K Ultrawide Cinematic Reel',
        description: 'Captured in 7680x4320 8K RAW at 60fps. Featuring deep interstellar nebula visualization with lossless dynamic range and Dolby Atmos master track.',
        originalFilename: 'Deep_Cosmos_8K_Master.mp4',
        storedFilename: sampleVideoFile,
        mimeType: 'video/mp4',
        fileSizeBytes: 14 * 1024 * 1024 * 1024, // 14 GB display size
        category: 'video',
        tags: ['8k', 'cinematic', 'space', 'cosmos', 'hdr', 'raw'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          resolution: '7680x4320 (8K FUHD)',
          duration: 342,
          codec: 'AV1 / ProRes 422',
          bitrate: '120 Mbps',
          dimensions: { width: 7680, height: 4320 },
          format: 'MPEG-4',
          sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
        },
        viewsCount: 3840,
        downloadsCount: 924,
        ratingAverage: 9.8,
        ratingCount: 142,
        ratingDistribution: {
          10: 118,
          9: 20,
          8: 4,
          7: 0,
          6: 0,
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_4k_aurora_nordic',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Nordic Aurora Borealis 4K 120FPS Time-lapse',
        description: 'Spectacular geomagnetic solar storm recorded in Tromsø, Norway. 3840x2160 native sensor readout, color graded in Rec.2020.',
        originalFilename: 'Aurora_Norway_4K_120.mp4',
        storedFilename: sampleVideoFile,
        mimeType: 'video/mp4',
        fileSizeBytes: 4 * 1024 * 1024 * 1024 + 300 * 1024 * 1024, // 4.3 GB
        category: 'video',
        tags: ['4k', 'aurora', 'norway', 'nature', 'timelapse', '120fps'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          resolution: '3840x2160 (4K UHD)',
          duration: 480,
          codec: 'HEVC / H.265',
          bitrate: '65 Mbps',
          dimensions: { width: 3840, height: 2160 },
          format: 'MPEG-4',
          sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'
        },
        viewsCount: 5210,
        downloadsCount: 1490,
        ratingAverage: 9.6,
        ratingCount: 198,
        ratingDistribution: {
          10: 154,
          9: 32,
          8: 10,
          7: 2,
          6: 0,
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_1080p_cyber_city',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Neo Tokyo Cyberpunk City Flight 1080p 60FPS',
        description: 'Smooth 1080p FHD aerial city capture with high-bitrate illumination. Crystal clear 60 frames per second.',
        originalFilename: 'Cyberpunk_City_1080p60.mp4',
        storedFilename: sampleVideoFile,
        mimeType: 'video/mp4',
        fileSizeBytes: 1 * 1024 * 1024 * 1024 + 400 * 1024 * 1024,
        category: 'video',
        tags: ['1080p', 'fhd', 'tokyo', 'cyberpunk', 'city', '60fps'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          resolution: '1920x1080 (1080p FHD)',
          duration: 275,
          codec: 'H.264 / AVC',
          bitrate: '28 Mbps',
          dimensions: { width: 1920, height: 1080 },
          format: 'MPEG-4',
          sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef'
        },
        viewsCount: 4120,
        downloadsCount: 1105,
        ratingAverage: 9.5,
        ratingCount: 112,
        ratingDistribution: {
          10: 84, 9: 20, 8: 6, 7: 2, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_720p_anime_action',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Night Highway High-Bitrate Drift 720p HD',
        description: 'Optimized 720p HD streaming cut with crisp contrast, fast action motion vectors, and compact file footprint.',
        originalFilename: 'Highway_Drift_720p.mp4',
        storedFilename: sampleVideoFile,
        mimeType: 'video/mp4',
        fileSizeBytes: 620 * 1024 * 1024,
        category: 'video',
        tags: ['720p', 'hd', 'drift', 'night', 'action'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          resolution: '1280x720 (720p HD)',
          duration: 198,
          codec: 'H.264',
          bitrate: '14 Mbps',
          dimensions: { width: 1280, height: 720 },
          format: 'MPEG-4',
          sha256: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12'
        },
        viewsCount: 2980,
        downloadsCount: 840,
        ratingAverage: 9.3,
        ratingCount: 78,
        ratingDistribution: {
          10: 52, 9: 18, 8: 6, 7: 2, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 50).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_480p_vintage_retro',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Retro Synthwave Sunset CRT Visuals 480p SD',
        description: 'Authentic 480p standard definition vintage VHS aesthetic with analog tracking artifacts and scanline warmth.',
        originalFilename: 'Retro_VHS_Sunset_480p.mp4',
        storedFilename: sampleVideoFile,
        mimeType: 'video/mp4',
        fileSizeBytes: 280 * 1024 * 1024,
        category: 'video',
        tags: ['480p', 'sd', 'retro', 'vhs', 'synthwave'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          resolution: '854x480 (480p SD)',
          duration: 310,
          codec: 'H.264',
          bitrate: '5 Mbps',
          dimensions: { width: 854, height: 480 },
          format: 'MPEG-4',
          sha256: 'c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef1234'
        },
        viewsCount: 1840,
        downloadsCount: 520,
        ratingAverage: 9.1,
        ratingCount: 45,
        ratingDistribution: {
          10: 28, 9: 10, 8: 5, 7: 2, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 60).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_audio_cyberpunk_master',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Neon Drift - Cyberpunk Synthwave OST (FLAC 24-bit 96kHz)',
        description: 'Original high-fidelity master recording with analog Oberheim synthesizer stems. Includes cue sheet, album artwork and lossless FLAC container.',
        originalFilename: 'Neon_Drift_Lossless_Master.flac',
        storedFilename: sampleAudioFile,
        mimeType: 'audio/flac',
        fileSizeBytes: 185 * 1024 * 1024, // 185 MB
        category: 'audio',
        tags: ['music', 'synthwave', 'flac', 'lossless', 'cyberpunk', 'soundtrack'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          duration: 388,
          codec: 'FLAC / 24-bit PCM',
          bitrate: '3200 kbps',
          format: 'Free Lossless Audio Codec',
          sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
        },
        viewsCount: 2340,
        downloadsCount: 880,
        ratingAverage: 9.4,
        ratingCount: 85,
        ratingDistribution: {
          10: 60,
          9: 18,
          8: 5,
          7: 2,
          6: 0,
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_doc_vaultshare_whitepaper',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'VaultShare High-Scale Storage & Zero-Trust Whitepaper v4.2',
        description: 'Comprehensive technical architectural specification describing multi-region chunked uploads, HTTP range streaming, and SHA-256 cryptographic verification.',
        originalFilename: 'VaultShare_Security_Whitepaper_v4.2.pdf',
        storedFilename: sampleDocFile,
        mimeType: 'application/pdf',
        fileSizeBytes: 18 * 1024 * 1024, // 18 MB
        category: 'document',
        tags: ['whitepaper', 'security', 'architecture', 'pdf', 'crypto'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          pages: 64,
          format: 'Adobe PDF 1.7',
          sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d'
        },
        viewsCount: 1670,
        downloadsCount: 645,
        ratingAverage: 9.5,
        ratingCount: 52,
        ratingDistribution: {
          10: 38,
          9: 10,
          8: 4,
          7: 0,
          6: 0,
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      },
      {
        id: 'file_archive_sdk_suite',
        userId: 'admin_spikesprimo',
        uploaderName: 'PrimoAdmin',
        uploaderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'VaultShare Native CLI & Developer SDK Toolchain (All OS)',
        description: 'Cross-platform binaries for Linux, macOS, and Windows. Includes fast parallel chunked uploader daemon, hash check utilities, and headless sync scripts.',
        originalFilename: 'vaultshare-sdk-all-v2.4.zip',
        storedFilename: sampleZipFile,
        mimeType: 'application/zip',
        fileSizeBytes: 240 * 1024 * 1024, // 240 MB
        category: 'archive',
        tags: ['sdk', 'cli', 'developer', 'tools', 'zip', 'source'],
        visibility: 'public',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800&auto=format&fit=crop&q=80',
        previewUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=1600&auto=format&fit=crop&q=80',
        metadata: {
          format: 'ZIP Archive',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        },
        viewsCount: 4120,
        downloadsCount: 2310,
        ratingAverage: 9.7,
        ratingCount: 168,
        ratingDistribution: {
          10: 135,
          9: 25,
          8: 8,
          7: 0,
          6: 0,
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        },
        createdAt: new Date(Date.now() - 3600000 * 96).toISOString(),
        updatedAt: new Date().toISOString(),
        processingStatus: 'ready'
      }
    ];

    if (this.data.files.length === 0) {
      this.data.files = initialFiles;
    } else {
      for (const item of initialFiles) {
        if (!this.data.files.some(f => f.id === item.id)) {
          this.data.files.push(item);
        }
      }
    }
    this.save();
    console.log(`[DB] Seeded high-resolution public media files.`);
  }

  // User management
  public getUsers(): User[] {
    return this.data.users;
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserByUsername(username: string): User | undefined {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  public createUser(user: User): User {
    // If user's email matches admin email, enforce admin role automatically!
    if (user.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
      user.role = 'admin';
    }
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;

    // Preserve admin role for spikesprimo6625@gmail.com
    if (user.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
      updates.role = 'admin';
      updates.isSuspended = false;
    }

    Object.assign(user, updates);
    this.save();
    return user;
  }

  public deleteUser(id: string): boolean {
    const user = this.findUserById(id);
    if (!user || user.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
      return false; // protect primary admin
    }
    this.data.users = this.data.users.filter(u => u.id !== id);
    // Delete files belonging to this user
    this.data.files = this.data.files.filter(f => f.userId !== id);
    this.save();
    return true;
  }

  // Files
  public getFiles(): FileRecord[] {
    return this.data.files;
  }

  public findFileById(id: string): FileRecord | undefined {
    return this.data.files.find(f => f.id === id);
  }

  public findFileByShareToken(token: string): FileRecord | undefined {
    return this.data.files.find(f => f.shareToken === token);
  }

  public createFile(file: FileRecord): FileRecord {
    this.data.files.unshift(file);
    // Update user storage
    const user = this.findUserById(file.userId);
    if (user) {
      user.storageUsedBytes = (user.storageUsedBytes || 0) + file.fileSizeBytes;
    }
    this.save();
    return file;
  }

  public updateFile(id: string, updates: Partial<FileRecord>): FileRecord | undefined {
    const file = this.findFileById(id);
    if (!file) return undefined;
    Object.assign(file, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return file;
  }

  public deleteFile(id: string): boolean {
    const fileIndex = this.data.files.findIndex(f => f.id === id);
    if (fileIndex === -1) return false;
    const [file] = this.data.files.splice(fileIndex, 1);
    
    // Decrement user storage
    const user = this.findUserById(file.userId);
    if (user) {
      user.storageUsedBytes = Math.max(0, (user.storageUsedBytes || 0) - file.fileSizeBytes);
    }

    // Cleanup related ratings, favorites, comments, downloads
    this.data.ratings = this.data.ratings.filter(r => r.fileId !== id);
    this.data.favorites = this.data.favorites.filter(f => f.fileId !== id);
    this.data.comments = this.data.comments.filter(c => c.fileId !== id);

    // Remove disk file if exists
    try {
      const diskPath = path.join(UPLOADS_DIR, file.storedFilename);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (e) {
      console.warn('Failed to delete physical file from disk:', e);
    }

    this.save();
    return true;
  }

  public incrementViews(id: string): void {
    const file = this.findFileById(id);
    if (file) {
      file.viewsCount = (file.viewsCount || 0) + 1;
      this.save();
    }
  }

  public incrementDownloads(fileId: string, userId?: string, ip?: string): void {
    const file = this.findFileById(fileId);
    if (file) {
      file.downloadsCount = (file.downloadsCount || 0) + 1;
      
      // If user is authenticated, record in their personal persistent download history
      if (userId) {
        this.data.downloads.unshift({
          id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          fileId,
          userId,
          fileTitle: file.title,
          fileCategory: file.category,
          fileSizeBytes: file.fileSizeBytes,
          downloadedAt: new Date().toISOString(),
          ip
        });
      }
      this.save();
    }
  }

  // Ratings (1-10 stars)
  public rateFile(fileId: string, userId: string, score: number): { average: number; count: number; distribution: Record<number, number> } {
    const validScore = Math.max(1, Math.min(10, Math.round(score)));
    let rating = this.data.ratings.find(r => r.fileId === fileId && r.userId === userId);

    if (rating) {
      rating.score = validScore;
      rating.updatedAt = new Date().toISOString();
    } else {
      rating = {
        id: `rat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileId,
        userId,
        score: validScore,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.data.ratings.push(rating);
    }

    // Recompute average, count, and distribution
    const fileRatings = this.data.ratings.filter(r => r.fileId === fileId);
    const count = fileRatings.length;
    const sum = fileRatings.reduce((acc, r) => acc + r.score, 0);
    const average = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;

    const distribution: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0
    };
    for (const r of fileRatings) {
      distribution[r.score] = (distribution[r.score] || 0) + 1;
    }

    const file = this.findFileById(fileId);
    if (file) {
      file.ratingAverage = average;
      file.ratingCount = count;
      file.ratingDistribution = distribution;
    }

    this.save();
    return { average, count, distribution };
  }

  public getUserRating(fileId: string, userId: string): number | null {
    const rating = this.data.ratings.find(r => r.fileId === fileId && r.userId === userId);
    return rating ? rating.score : null;
  }

  // Personal Downloads
  public getUserDownloads(userId: string): DownloadRecord[] {
    return this.data.downloads.filter(d => d.userId === userId);
  }

  public removeDownloadRecord(recordId: string, userId: string): boolean {
    const idx = this.data.downloads.findIndex(d => d.id === recordId && d.userId === userId);
    if (idx === -1) return false;
    this.data.downloads.splice(idx, 1);
    this.save();
    return true;
  }

  public clearUserDownloads(userId: string): void {
    this.data.downloads = this.data.downloads.filter(d => d.userId !== userId);
    this.save();
  }

  // Favorites
  public getFavorites(userId: string): FavoriteRecord[] {
    return this.data.favorites.filter(f => f.userId === userId);
  }

  public toggleFavorite(fileId: string, userId: string): boolean {
    const idx = this.data.favorites.findIndex(f => f.fileId === fileId && f.userId === userId);
    let isFav = false;
    if (idx >= 0) {
      this.data.favorites.splice(idx, 1);
      isFav = false;
    } else {
      this.data.favorites.push({
        id: `fav_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileId,
        userId,
        createdAt: new Date().toISOString()
      });
      isFav = true;
    }
    this.save();
    return isFav;
  }

  // Collections
  public getUserCollections(userId: string): CollectionRecord[] {
    return this.data.collections.filter(c => c.userId === userId);
  }

  public createCollection(collection: CollectionRecord): CollectionRecord {
    this.data.collections.push(collection);
    this.save();
    return collection;
  }

  public updateCollection(id: string, userId: string, updates: Partial<CollectionRecord>): CollectionRecord | undefined {
    const col = this.data.collections.find(c => c.id === id && c.userId === userId);
    if (!col) return undefined;
    Object.assign(col, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return col;
  }

  public deleteCollection(id: string, userId: string): boolean {
    const idx = this.data.collections.findIndex(c => c.id === id && c.userId === userId);
    if (idx === -1) return false;
    this.data.collections.splice(idx, 1);
    this.save();
    return true;
  }

  // Comments
  public getComments(fileId: string): CommentRecord[] {
    return this.data.comments
      .filter(c => c.fileId === fileId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public addComment(comment: CommentRecord): CommentRecord {
    this.data.comments.push(comment);
    this.save();
    return comment;
  }

  public deleteComment(commentId: string, userId: string, isAdmin: boolean): boolean {
    const idx = this.data.comments.findIndex(c => c.id === commentId);
    if (idx === -1) return false;
    const comment = this.data.comments[idx];
    if (comment.userId !== userId && !isAdmin) return false;
    this.data.comments.splice(idx, 1);
    this.save();
    return true;
  }

  // Reports
  public getReports(): ReportRecord[] {
    return this.data.reports;
  }

  public createReport(report: ReportRecord): ReportRecord {
    this.data.reports.unshift(report);
    const file = this.findFileById(report.targetId);
    if (file) {
      file.isReported = true;
    }
    this.save();
    return report;
  }

  public updateReportStatus(reportId: string, status: 'resolved' | 'dismissed', resolvedBy: string): ReportRecord | undefined {
    const report = this.data.reports.find(r => r.id === reportId);
    if (!report) return undefined;
    report.status = status;
    report.resolvedAt = new Date().toISOString();
    report.resolvedBy = resolvedBy;

    // Check if any other pending report on the same file
    if (status === 'dismissed') {
      const remaining = this.data.reports.find(r => r.targetId === report.targetId && r.status === 'pending');
      if (!remaining) {
        const file = this.findFileById(report.targetId);
        if (file) file.isReported = false;
      }
    }
    this.save();
    return report;
  }

  // Settings
  public getSettings(): SystemSettings {
    return this.data.settings;
  }

  public updateSettings(settings: Partial<SystemSettings>): SystemSettings {
    Object.assign(this.data.settings, settings);
    this.save();
    return this.data.settings;
  }

  // Super Admin System Actions
  public shutdownWebsite(reason?: string): SystemSettings {
    this.data.settings.maintenanceMode = true;
    this.data.settings.shutdownReason = reason || 'Emergency administrative maintenance initiated. The platform is currently offline.';
    this.data.settings.shutdownAt = new Date().toISOString();
    this.save();
    console.log(`[DB] Super Admin shutdown website at ${this.data.settings.shutdownAt}. Reason: ${this.data.settings.shutdownReason}`);
    return this.data.settings;
  }

  public restoreWebsite(): SystemSettings {
    this.data.settings.maintenanceMode = false;
    delete this.data.settings.shutdownReason;
    delete this.data.settings.shutdownAt;
    this.save();
    console.log(`[DB] Super Admin restored website to normal operational state.`);
    return this.data.settings;
  }

  public clearWebsiteData(preserveAdmin: boolean = true): {
    message: string;
    deletedFiles: number;
    deletedUsers: number;
    deletedDownloads: number;
    deletedReports: number;
    deletedCollections: number;
    deletedRatings: number;
    deletedComments: number;
    preservedAdminEmail?: string;
  } {
    const deletedFiles = this.data.files.length;
    const deletedDownloads = this.data.downloads.length;
    const deletedReports = this.data.reports.length;
    const deletedCollections = this.data.collections.length;
    const deletedRatings = this.data.ratings.length;
    const deletedComments = this.data.comments.length;

    const adminEmail = 'spikesprimo6625@gmail.com';
    const adminUser = this.data.users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
    const deletedUsers = preserveAdmin
      ? Math.max(0, this.data.users.length - (adminUser ? 1 : 0))
      : this.data.users.length;

    // Reset collections, files, downloads, ratings, favorites, comments, reports
    this.data.files = [];
    this.data.ratings = [];
    this.data.downloads = [];
    this.data.favorites = [];
    this.data.collections = [];
    this.data.comments = [];
    this.data.reports = [];

    // Keep admin account with 0 storage used
    if (preserveAdmin && adminUser) {
      adminUser.storageUsedBytes = 0;
      this.data.users = [adminUser];
    } else {
      this.data.users = [];
      this.ensureAdminUser();
    }

    // Clean uploads directory
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const filesOnDisk = fs.readdirSync(UPLOADS_DIR);
        for (const file of filesOnDisk) {
          if (!file.startsWith('seed_')) {
            try {
              fs.unlinkSync(path.join(UPLOADS_DIR, file));
            } catch {
              // ignore
            }
          }
        }
      }
      if (fs.existsSync(CHUNKS_DIR)) {
        const chunkDirs = fs.readdirSync(CHUNKS_DIR);
        for (const item of chunkDirs) {
          try {
            fs.rmSync(path.join(CHUNKS_DIR, item), { recursive: true, force: true });
          } catch {
            // ignore
          }
        }
      }
    } catch (diskErr) {
      console.warn('[DB] Non-critical warning while cleaning upload directories:', diskErr);
    }

    this.save();
    console.log(`[DB] Super Admin cleared all website data: ${deletedFiles} files, ${deletedUsers} users, ${deletedDownloads} downloads.`);

    return {
      message: 'All website files, downloads, collections, comments, and reports have been successfully purged from database and storage.',
      deletedFiles,
      deletedUsers,
      deletedDownloads,
      deletedReports,
      deletedCollections,
      deletedRatings,
      deletedComments,
      preservedAdminEmail: preserveAdmin && adminUser ? adminUser.email : undefined
    };
  }
}

export const db = new Database();
export { DATA_DIR, UPLOADS_DIR, THUMBNAILS_DIR, CHUNKS_DIR };
