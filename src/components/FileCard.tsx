import React from 'react';
import {
  Play,
  Download,
  Eye,
  Star,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Archive,
  Terminal,
  BookOpen,
  Sparkles,
  Share2
} from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes, formatDuration, formatRelativeTime } from '../utils/formatters';
import { useAudio } from '../context/AudioContext';

interface FileCardProps {
  file: FileItem;
  onSelect: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  isOfflineAvailable?: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  onSelect,
  onShare,
  onDownload,
  isOfflineAvailable = false
}) => {
  const { playTrack, currentTrack, isPlaying } = useAudio();

  const isCurrentAudioPlaying = currentTrack?.id === file.id && isPlaying;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'video':
        return <Film className="w-4 h-4 text-rose-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-sky-400" />;
      case 'document':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-indigo-400" />;
      case 'software':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'ebook':
        return <BookOpen className="w-4 h-4 text-orange-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  const handleQuickPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.category === 'audio') {
      playTrack(file);
    } else {
      onSelect(file);
    }
  };

  const res = file.metadata?.resolution || '';
  const is8K = res.includes('8K');
  const is4K = res.includes('4K') && !is8K;
  const is1080p = res.includes('1080');
  const is720p = res.includes('720');
  const is480p = res.includes('480');
  const isGenericHD = (res.toLowerCase().includes('hd') || res.includes('720') || res.includes('1080')) && !is4K && !is8K && !is1080p && !is720p;

  return (
    <div
      onClick={() => onSelect(file)}
      className="group relative bg-[#12131a] border border-[#202330] hover:border-purple-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/10 flex flex-col justify-between"
    >
      {/* Media Thumbnail Container */}
      <div className="relative aspect-video w-full bg-[#0a0b0e] overflow-hidden">
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#161822] to-[#0f1016]">
            {getCategoryIcon(file.category)}
            <span className="text-xs text-gray-400 mt-2 uppercase tracking-wider font-semibold font-mono">
              {file.metadata?.format || file.category}
            </span>
          </div>
        )}

        {/* Play button overlay: always visible for video/audio, with pulse on hover */}
        {(file.category === 'video' || file.category === 'audio') && (
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <button
              type="button"
              onClick={handleQuickPlay}
              className="w-12 h-12 rounded-full bg-purple-600/90 group-hover:bg-purple-500 text-white shadow-xl shadow-purple-950/60 flex items-center justify-center border border-white/20 transform transition-all group-hover:scale-115 active:scale-95"
              title={file.category === 'audio' ? 'Play Audio' : 'Play Video'}
            >
              <Play className={`w-5 h-5 ${isCurrentAudioPlaying ? 'fill-white' : 'fill-white/90'} ml-0.5`} />
            </button>
          </div>
        )}

        {/* Resolution Badges (8K / 4K / 1080p / 720p / 480p / HD) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap z-10">
          {is8K && (
            <span className="bg-gradient-to-r from-rose-500 to-purple-600 text-[10px] font-black px-2 py-0.5 rounded-md text-white tracking-wider shadow">
              8K FUHD
            </span>
          )}
          {is4K && (
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-md text-white tracking-wider shadow">
              4K UHD
            </span>
          )}
          {is1080p && (
            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 text-[10px] font-black px-2 py-0.5 rounded-md text-white tracking-wider shadow">
              1080p FHD
            </span>
          )}
          {is720p && (
            <span className="bg-gradient-to-r from-cyan-600 to-blue-500 text-[10px] font-black px-2 py-0.5 rounded-md text-white tracking-wider shadow">
              720p HD
            </span>
          )}
          {is480p && (
            <span className="bg-gradient-to-r from-amber-600 to-orange-500 text-[10px] font-black px-2 py-0.5 rounded-md text-white tracking-wider shadow">
              480p SD
            </span>
          )}
          {isGenericHD && (
            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 text-[10px] font-black px-2 py-0.5 rounded-md text-white tracking-wider shadow">
              HD
            </span>
          )}
          {isOfflineAvailable && (
            <span className="bg-emerald-600/90 text-[10px] font-bold px-1.5 py-0.5 rounded text-white shadow">
              Offline Ready
            </span>
          )}
        </div>

        {/* Duration / Size tag */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {file.metadata?.duration ? (
            <span className="bg-black/80 backdrop-blur-md text-[11px] font-mono text-gray-200 px-2 py-0.5 rounded">
              {formatDuration(file.metadata.duration)}
            </span>
          ) : (
            <span className="bg-black/80 backdrop-blur-md text-[11px] font-mono text-gray-300 px-2 py-0.5 rounded">
              {formatBytes(file.fileSizeBytes)}
            </span>
          )}
        </div>
      </div>

      {/* Card Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-gray-400 capitalize">
              {getCategoryIcon(file.category)}
              <span>{file.category}</span>
            </span>

            {/* 10-Star Rating Badge */}
            <div className="flex items-center gap-1 bg-[#1a1c26] px-2 py-0.5 rounded-md border border-[#2b2f42]">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-gray-200">
                {file.ratingAverage > 0 ? file.ratingAverage.toFixed(1) : '—'}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">/10</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-bold text-sm text-gray-100 group-hover:text-purple-300 transition-colors line-clamp-1 mb-1">
            {file.title}
          </h3>

          {/* Description preview */}
          {file.description && (
            <p className="text-xs text-gray-400 line-clamp-1 mb-3">
              {file.description}
            </p>
          )}
        </div>

        {/* Footer info: Uploader, Views, Download */}
        <div className="pt-3 border-t border-[#1c1f2b] flex items-center justify-between mt-2 text-xs text-gray-400">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            {file.uploaderAvatar ? (
              <img
                src={file.uploaderAvatar}
                alt={file.uploaderName}
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-purple-900/60 flex items-center justify-center text-[10px] font-bold text-purple-200 shrink-0">
                {file.uploaderName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate text-gray-300 font-medium">
              {file.uploaderName}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1 text-gray-500" title={`${file.viewsCount} views`}>
              <Eye className="w-3.5 h-3.5" />
              <span>{file.viewsCount}</span>
            </span>

            <span className="flex items-center gap-1 text-gray-500" title={`${file.downloadsCount} downloads`}>
              <Download className="w-3.5 h-3.5" />
              <span>{file.downloadsCount}</span>
            </span>

            {onShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(file);
                }}
                className="text-gray-500 hover:text-purple-300 transition p-1"
                title="Share file"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
