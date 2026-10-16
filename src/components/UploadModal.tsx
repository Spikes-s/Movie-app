import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Archive,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
  Globe,
  Link2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FileUploader } from '../services/api';
import { FileItem } from '../types';
import { formatBytes, detectCategory } from '../utils/formatters';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newFile: FileItem) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');

  // Metadata extracted client-side
  const [resolution, setResolution] = useState<string>('');
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string>('');

  // Upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [transferredBytes, setTransferredBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [speedBytes, setSpeedBytes] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploaderRef = useRef<FileUploader | null>(null);

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setCategory('other');
    setTags('');
    setVisibility('public');
    setResolution('');
    setDuration(undefined);
    setThumbnailDataUrl('');
    setIsUploading(false);
    setIsPaused(false);
    setUploadPercentage(0);
    setTransferredBytes(0);
    setTotalBytes(0);
    setSpeedBytes(0);
    setEtaSeconds(0);
    setUploadStatus('');
    setErrorMessage(null);
    uploaderRef.current = null;
  };

  const handleClose = () => {
    if (isUploading) {
      if (!confirm('An upload is currently in progress. Are you sure you want to cancel?')) {
        return;
      }
      if (uploaderRef.current) uploaderRef.current.cancel();
    }
    resetForm();
    onClose();
  };

  // Client-side metadata & thumbnail extraction
  const processSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));
    setTotalBytes(file.size);
    const cat = detectCategory(file.type, file.name);
    setCategory(cat);

    // If Video: Extract duration, resolution and frame thumbnail
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        let resLabel = `${w}x${h}`;
        if (w >= 7000 || h >= 4000) resLabel += ' (8K FUHD)';
        else if (w >= 3600 || h >= 2000) resLabel += ' (4K UHD)';
        else if (w >= 1900 || h >= 1000) resLabel += ' (1080p FHD)';
        else if (w >= 1200 || h >= 700) resLabel += ' (720p HD)';
        else if (w >= 800 || h >= 450) resLabel += ' (480p SD)';
        else resLabel += ' (480p SD)';

        setResolution(resLabel);
        setDuration(video.duration);

        // Capture frame at 1 second
        video.currentTime = Math.min(1.0, video.duration / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, video.videoWidth);
          canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);
            setThumbnailDataUrl(thumbUrl);
          }
        } catch (e) {
          console.warn('Could not generate video frame snapshot:', e);
        }
      };
    } else if (file.type.startsWith('image/')) {
      // Image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setThumbnailDataUrl(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);

    const parsedTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const uploader = new FileUploader(
      selectedFile,
      {
        title: title || selectedFile.name,
        description,
        category,
        tags: parsedTags,
        visibility,
        resolution,
        duration,
        thumbnailDataUrl
      },
      (progress) => {
        setUploadPercentage(progress.percentage);
        setTransferredBytes(progress.transferredBytes);
        setTotalBytes(progress.totalBytes);
        setSpeedBytes(progress.speedBytesPerSec);
        setEtaSeconds(progress.estimatedSecondsRemaining);
        setUploadStatus(
          progress.status === 'assembling'
            ? 'Assembling & hashing high-resolution media...'
            : progress.status === 'uploading'
            ? 'Uploading to secure GhostShare storage...'
            : progress.status === 'completed'
            ? 'Processing complete!'
            : progress.status === 'paused'
            ? 'Upload paused'
            : ''
        );
      }
    );

    uploaderRef.current = uploader;

    try {
      const uploadedItem = await uploader.start();
      onUploadSuccess(uploadedItem);
      resetForm();
      onClose();
    } catch (err: any) {
      if (err.message !== 'Upload paused' && err.message !== 'Upload cancelled') {
        setErrorMessage(err.message || 'File upload failed');
      }
      setIsUploading(false);
    }
  };

  const handleTogglePause = () => {
    if (!uploaderRef.current) return;
    if (isPaused) {
      setIsPaused(false);
      // Restart
      handleStartUpload({ preventDefault: () => {} } as any);
    } else {
      setIsPaused(true);
      uploaderRef.current.pause();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#111219] border border-[#232738] rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2230]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upload Digital Media</h2>
              <p className="text-xs text-gray-400">Supports 8K, 4K, 1080p, 720p, 480p Video, Lossless Audio, Archives & Documents</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1f2230] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!selectedFile ? (
            /* Dropzone */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-[#2b3044] hover:border-purple-500/60 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all bg-[#0e0f15]/50 group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                Drag and drop your file here
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mb-4">
                Videos up to 8K, lossless FLAC/WAV audio, high-res photos, archives, PDFs, or software binaries.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                >
                  Choose File
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-[#1d202c] hover:bg-[#252939] text-gray-300 text-xs font-semibold rounded-xl border border-[#2d3245] transition"
                >
                  Select Folder
                </button>
              </div>

              <div className="mt-6 flex items-center gap-4 text-[11px] text-gray-500">
                <span>Direct & Resumable Chunks</span>
                <span>•</span>
                <span>SHA-256 Verified</span>
                <span>•</span>
                <span>Max 50 GB / file</span>
              </div>
            </div>
          ) : (
            /* File Form & Progress */
            <form onSubmit={handleStartUpload} className="space-y-4">
              {/* Selected File Card */}
              <div className="flex items-center gap-3 p-3 bg-[#161822] border border-[#232738] rounded-2xl">
                {thumbnailDataUrl ? (
                  <img
                    src={thumbnailDataUrl}
                    alt="Preview"
                    className="w-16 h-12 rounded-lg object-cover bg-black"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#1f2230] flex items-center justify-center text-purple-400">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{selectedFile.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span>{formatBytes(selectedFile.size)}</span>
                    {resolution && (
                      <span className="text-purple-400 font-mono font-medium">[{resolution}]</span>
                    )}
                  </div>
                </div>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#232738] transition"
                    title="Change file"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Progress Bar (when uploading) */}
              {isUploading && (
                <div className="p-4 bg-[#141620] border border-purple-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {uploadStatus || 'Transferring data...'}
                    </span>
                    <span className="font-mono text-white font-bold">{uploadPercentage}%</span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-[#1e2230] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadPercentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span>
                      {formatBytes(transferredBytes)} / {formatBytes(totalBytes)}
                    </span>
                    <div className="flex items-center gap-3">
                      {speedBytes > 0 && <span>{formatBytes(speedBytes)}/s</span>}
                      {etaSeconds > 0 && <span>ETA {etaSeconds}s</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="px-3 py-1 bg-[#1e2230] hover:bg-[#282d40] text-xs text-gray-300 rounded-lg flex items-center gap-1.5 transition"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-3 py-1 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-xs text-rose-300 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isUploading}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., 8K Cosmic Nebula Master Cut"
                    className="w-full px-3.5 py-2 bg-[#161822] border border-[#262a3a] focus:border-purple-500 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    disabled={isUploading}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#161822] border border-[#262a3a] focus:border-purple-500 rounded-xl text-white text-xs focus:outline-none transition capitalize"
                  >
                    <option value="video">Video & Movie (4K/8K)</option>
                    <option value="audio">Music & Audio</option>
                    <option value="image">Image & Photography</option>
                    <option value="document">PDF & Document</option>
                    <option value="archive">Archive & ZIP</option>
                    <option value="software">Software & Code</option>
                    <option value="ebook">E-Book</option>
                    <option value="design">Design & 3D Asset</option>
                    <option value="other">Other Binary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Visibility
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setVisibility('public')}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                        visibility === 'public'
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-[#161822] border-[#262a3a] text-gray-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Public</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setVisibility('unlisted')}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                        visibility === 'unlisted'
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-[#161822] border-[#262a3a] text-gray-400 hover:text-white'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Unlisted</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setVisibility('private')}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                        visibility === 'private'
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-[#161822] border-[#262a3a] text-gray-400 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Private</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    disabled={isUploading}
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="4k, raw, soundtrack, nature, architecture"
                    className="w-full px-3.5 py-2 bg-[#161822] border border-[#262a3a] focus:border-purple-500 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    disabled={isUploading}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details about codecs, resolution, capture equipment, or instructions..."
                    className="w-full px-3.5 py-2 bg-[#161822] border border-[#262a3a] focus:border-purple-500 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f2230]">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleClose}
                  className="px-4 py-2 bg-[#1a1d28] hover:bg-[#232737] text-gray-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !title.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 transition disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Publish to Vault'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
