import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Share2,
  Heart,
  Flag,
  Calendar,
  HardDrive,
  Eye,
  FileCode,
  ShieldCheck,
  Film,
  Music,
  Check,
  WifiOff,
  Maximize2,
  Send,
  Trash2,
  ExternalLink,
  Play,
  Pause,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Sparkles,
  Zap
} from 'lucide-react';
import { FileItem, CommentItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { TenStarRating } from './TenStarRating';
import { formatBytes, formatDuration, formatDate, formatRelativeTime } from '../utils/formatters';
import { isFileOffline, saveFileOffline, deleteOfflineFile } from '../services/offlineStorage';

interface FileDetailModalProps {
  fileId: string;
  isOpen: boolean;
  onClose: () => void;
  onShare: (file: FileItem) => void;
  onReport: (file: FileItem) => void;
  onFileUpdated?: (file: FileItem) => void;
  onRequireLogin: () => void;
}

export const FileDetailModal: React.FC<FileDetailModalProps> = ({
  fileId,
  isOpen,
  onClose,
  onShare,
  onReport,
  onFileUpdated,
  onRequireLogin
}) => {
  const { user, isAdmin } = useAuth();
  const { playTrack } = useAudio();

  const [file, setFile] = useState<FileItem | null>(null);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoVolume, setVideoVolume] = useState<number>(1);
  const [gestureHUD, setGestureHUD] = useState<{
    type: 'volume' | 'speed' | 'rewind' | 'play_state';
    text: string;
    value?: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    side: 'left' | 'right';
    startVolume: number;
  } | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rewindIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingVolumeRef = useRef<boolean>(false);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen || !fileId) return;

    let mounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [fileRes, commentsRes, offlineStatus] = await Promise.all([
          api.getFile(fileId),
          api.getComments(fileId),
          isFileOffline(fileId)
        ]);

        if (mounted) {
          setFile(fileRes.file);
          setIsFavorited(fileRes.isFavorited);
          setUserRating(fileRes.userRating);
          setComments(commentsRes.comments);
          setIsOffline(offlineStatus);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load file details:', err);
        if (mounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [fileId, isOpen]);

  const handleDownload = () => {
    if (!file) return;
    const downloadUrl = api.getDownloadUrl(file.id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.originalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Increment download count locally
    setFile(prev => prev ? { ...prev, downloadsCount: (prev.downloadsCount || 0) + 1 } : null);
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!file) return;

    try {
      const res = await api.toggleFavorite(file.id);
      setIsFavorited(res.isFavorited);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleOffline = async () => {
    if (!file) return;
    setIsSavingOffline(true);
    try {
      if (isOffline) {
        await deleteOfflineFile(file.id);
        setIsOffline(false);
      } else {
        // Fetch binary blob and store in IndexedDB
        const streamUrl = api.getStreamUrl(file.id);
        const res = await fetch(streamUrl);
        const blob = await res.blob();
        await saveFileOffline(file.id, file.title, file.category, file.mimeType, blob);
        setIsOffline(true);
      }
    } catch (err) {
      console.error('Failed to update offline storage:', err);
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleRatingUpdated = (
    newAvg: number,
    newCount: number,
    newDist: Record<number, number>,
    score: number
  ) => {
    if (!file) return;
    const updated = {
      ...file,
      ratingAverage: newAvg,
      ratingCount: newCount,
      ratingDistribution: newDist
    };
    setFile(updated);
    setUserRating(score);
    if (onFileUpdated) onFileUpdated(updated);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!newComment.trim() || !file) return;

    setIsSubmittingComment(true);
    try {
      const res = await api.addComment(file.id, newComment);
      setComments(prev => [...prev, res.comment]);
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const triggerHUD = (type: 'volume' | 'speed' | 'rewind' | 'play_state', text: string, value?: number) => {
    setGestureHUD({ type, text, value });
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      setGestureHUD(null);
    }, 1400);
  };

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {});
      triggerHUD('play_state', 'Playing');
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
      triggerHUD('play_state', 'Paused');
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !videoContainerRef.current || !videoRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const side = x > rect.width / 2 ? 'right' : 'left';

    pointerStartRef.current = {
      x,
      y,
      time: Date.now(),
      side,
      startVolume: videoRef.current.volume
    };
    isDraggingVolumeRef.current = false;

    // Long press detection (300ms)
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      if (!videoRef.current) return;
      if (side === 'right') {
        // Long press right side -> increase speed (2X)
        videoRef.current.playbackRate = 2.0;
        triggerHUD('speed', '2X Speed Boost >>');
      } else {
        // Long press left side -> go backwards (rewind)
        triggerHUD('rewind', '<< Rewinding (Jumping Back)');
        if (rewindIntervalRef.current) clearInterval(rewindIntervalRef.current);
        rewindIntervalRef.current = setInterval(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 2.5);
            triggerHUD('rewind', `<< Rewinding (${formatDuration(videoRef.current.currentTime)})`);
          }
        }, 200);
      }
    }, 300);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || !videoContainerRef.current || !videoRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    const currentY = e.clientY - rect.top;
    const deltaY = pointerStartRef.current.y - currentY; // positive = dragging UP

    // Dragging right side vertically to increase/decrease volume
    if (pointerStartRef.current.side === 'right' && Math.abs(deltaY) > 8) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      isDraggingVolumeRef.current = true;
      const sensitivity = 1.2;
      const volumeChange = (deltaY / (rect.height * 0.6)) * sensitivity;
      const newVol = Math.max(0, Math.min(1, pointerStartRef.current.startVolume + volumeChange));
      videoRef.current.volume = newVol;
      setVideoVolume(newVol);
      triggerHUD('volume', `Volume ${Math.round(newVol * 100)}%`, newVol);
    }
  };

  const handlePointerUp = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (rewindIntervalRef.current) {
      clearInterval(rewindIntervalRef.current);
      rewindIntervalRef.current = null;
    }

    if (videoRef.current) {
      // Restore playback speed if it was boosted
      if (videoRef.current.playbackRate !== playbackSpeed) {
        videoRef.current.playbackRate = playbackSpeed;
        triggerHUD('speed', `Speed ${playbackSpeed}x`);
      }
    }

    // If quick tap without drag or hold, toggle play/pause
    if (pointerStartRef.current && !isDraggingVolumeRef.current) {
      const elapsed = Date.now() - pointerStartRef.current.time;
      if (elapsed < 300) {
        toggleVideoPlay();
      }
    }

    pointerStartRef.current = null;
    isDraggingVolumeRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      if (rewindIntervalRef.current) clearInterval(rewindIntervalRef.current);
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-[#0f1017] border border-[#232738] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1f2e] bg-[#141520] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden mr-4">
            <span className="text-xs uppercase font-mono px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-800/40 text-purple-300 font-semibold shrink-0">
              {file?.category || 'Media'}
            </span>
            <h2 className="text-base font-bold text-white truncate">
              {file?.title || 'Loading Media...'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-[#202334] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading || !file ? (
            <div className="py-24 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs text-gray-400">Loading high-resolution asset...</p>
            </div>
          ) : (
            <>
              {/* Media Player Section */}
              <div className="rounded-2xl overflow-hidden bg-black border border-[#232738] shadow-2xl">
                {file.category === 'video' ? (
                  <div
                    ref={videoContainerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className="relative group select-none touch-none bg-black cursor-pointer overflow-hidden"
                  >
                    <video
                      ref={videoRef}
                      src={api.getStreamUrl(file.id)}
                      playsInline
                      poster={file.thumbnailUrl}
                      onPlay={() => setIsVideoPlaying(true)}
                      onPause={() => setIsVideoPlaying(false)}
                      className="w-full max-h-[500px] object-contain bg-black mx-auto pointer-events-none"
                    />

                    {/* Prominent Center Play/Pause Button */}
                    {!isVideoPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all pointer-events-none">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVideoPlay();
                          }}
                          className="pointer-events-auto w-20 h-20 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-500 hover:from-purple-600 hover:to-indigo-400 text-white flex items-center justify-center shadow-2xl shadow-purple-900/60 border-2 border-white/20 transform transition hover:scale-110 active:scale-95 group/btn"
                          title="Play Video"
                        >
                          <Play className="w-10 h-10 fill-white text-white ml-1.5 drop-shadow-md" />
                        </button>
                      </div>
                    )}

                    {/* HUD: Gesture Feedback Overlays */}
                    {gestureHUD && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        {gestureHUD.type === 'volume' && (
                          <div className="bg-black/85 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-purple-500/40 shadow-2xl flex flex-col items-center gap-2 min-w-[180px] animate-scale-in">
                            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                              {(gestureHUD.value ?? 1) === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
                              <span>{gestureHUD.text}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full transition-all duration-100"
                                style={{ width: `${Math.round((gestureHUD.value ?? 1) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">Drag vertically on right side</span>
                          </div>
                        )}

                        {gestureHUD.type === 'speed' && (
                          <div className="bg-purple-950/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-purple-400/60 shadow-2xl flex items-center gap-2.5 text-white font-extrabold text-sm animate-pulse">
                            <FastForward className="w-5 h-5 text-amber-400 fill-amber-400" />
                            <span>{gestureHUD.text}</span>
                          </div>
                        )}

                        {gestureHUD.type === 'rewind' && (
                          <div className="bg-cyan-950/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-cyan-400/60 shadow-2xl flex items-center gap-2.5 text-white font-extrabold text-sm animate-pulse">
                            <Rewind className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                            <span>{gestureHUD.text}</span>
                          </div>
                        )}

                        {gestureHUD.type === 'play_state' && (
                          <div className="bg-black/80 backdrop-blur-md p-4 rounded-full border border-white/20 text-white shadow-2xl animate-fade-in">
                            {gestureHUD.text === 'Playing' ? <Play className="w-8 h-8 fill-white" /> : <Pause className="w-8 h-8 fill-white" />}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Top Overlays */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                      {file.metadata?.resolution && (
                        <div className="bg-purple-900/80 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-md border border-purple-500/40 shadow">
                          {file.metadata.resolution}
                        </div>
                      )}
                    </div>

                    {/* Top Right: Speed Selector */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-xs pointer-events-auto">
                      <span className="text-gray-400 font-mono text-[10px]">Speed:</span>
                      {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaybackSpeedChange(s);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition ${
                            playbackSpeed === s
                              ? 'bg-purple-600 text-white font-bold'
                              : 'text-gray-300 hover:text-white'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>

                    {/* Bottom Custom Play Bar & Gesture Hint */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 flex flex-col gap-1.5 pointer-events-auto opacity-90 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVideoPlay();
                            }}
                            className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition shadow"
                            title={isVideoPlaying ? 'Pause' : 'Play'}
                          >
                            {isVideoPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                          </button>
                          <span className="text-xs text-gray-300 font-mono">
                            {isVideoPlaying ? 'Playing' : 'Paused'}
                          </span>
                        </div>

                        {/* Interactive Gesture Legend */}
                        <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-gray-300 bg-black/60 px-3 py-1 rounded-full border border-white/10">
                          <span className="text-cyan-300">👈 Hold Left: Rewind</span>
                          <span>•</span>
                          <span className="text-amber-300">👉 Hold Right: 2x Speed</span>
                          <span>•</span>
                          <span className="text-purple-300">↕️ Drag Right: Volume</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="font-mono text-[11px] text-gray-400">
                            Vol: {Math.round(videoVolume * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : file.category === 'audio' ? (
                  <div className="p-8 flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-br from-[#1b1c2b] to-[#11121c]">
                    <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-purple-500/20">
                      {file.thumbnailUrl ? (
                        <img
                          src={file.thumbnailUrl}
                          alt={file.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-purple-950/60 flex items-center justify-center text-purple-400">
                          <Music className="w-12 h-12" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full text-center sm:text-left">
                      <span className="text-xs uppercase font-mono text-purple-400 font-semibold tracking-wider">
                        Lossless Audio Master
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-1 mb-2">{file.title}</h3>
                      <p className="text-xs text-gray-400 mb-4 font-mono">
                        {file.metadata?.codec || 'Audio PCM'} • {formatBytes(file.fileSizeBytes)}
                        {file.metadata?.duration ? ` • ${formatDuration(file.metadata.duration)}` : ''}
                      </p>

                      <div className="flex items-center gap-3 justify-center sm:justify-start">
                        <button
                          onClick={() => playTrack(file)}
                          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-2 transition"
                        >
                          <Music className="w-4 h-4" />
                          <span>Play in Docked Player</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : file.category === 'image' ? (
                  <div className="p-4 bg-black/40 flex items-center justify-center">
                    <img
                      src={api.getStreamUrl(file.id)}
                      alt={file.title}
                      className="max-h-[500px] w-auto object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="p-12 flex flex-col items-center justify-center text-center bg-[#131520]">
                    <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                      <FileCode className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{file.originalFilename}</h3>
                    <p className="text-xs text-gray-400 max-w-md mb-6 font-mono">
                      Format: {file.metadata?.format || file.mimeType} • Size: {formatBytes(file.fileSizeBytes)}
                    </p>
                    <button
                      onClick={handleDownload}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Original File</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#141622] border border-[#212534] rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download ({formatBytes(file.fileSizeBytes)})</span>
                  </button>

                  <button
                    onClick={handleToggleOffline}
                    disabled={isSavingOffline}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                      isOffline
                        ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                        : 'bg-[#1b1e2c] border-[#292f44] text-gray-300 hover:text-white'
                    }`}
                    title={isOffline ? 'File stored on device' : 'Cache in browser storage for offline access'}
                  >
                    {isOffline ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5" />}
                    <span>{isSavingOffline ? 'Caching...' : isOffline ? 'Available Offline' : 'Save for Offline'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFavorite}
                    className={`p-2.5 rounded-xl border transition ${
                      isFavorited
                        ? 'bg-rose-950/50 border-rose-800/60 text-rose-400'
                        : 'bg-[#1b1e2c] border-[#292f44] text-gray-400 hover:text-white'
                    }`}
                    title={isFavorited ? 'Favorited' : 'Add to Favorites'}
                  >
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-400' : ''}`} />
                  </button>

                  <button
                    onClick={() => onShare(file)}
                    className="p-2.5 bg-[#1b1e2c] border border-[#292f44] text-gray-400 hover:text-white rounded-xl transition"
                    title="Share File"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onReport(file)}
                    className="p-2.5 bg-[#1b1e2c] border border-[#292f44] text-gray-400 hover:text-rose-400 rounded-xl transition"
                    title="Report Content"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid: Details & 10-Star Rating */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 cols: Description & Metadata */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Title & Description */}
                  <div className="bg-[#12131a] border border-[#212433] rounded-2xl p-6">
                    <h1 className="text-xl font-black text-white mb-2">{file.title}</h1>
                    <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed mb-4">
                      {file.description || 'No description provided by creator.'}
                    </p>

                    {file.tags && file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#1e2230]">
                        {file.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#191c28] border border-[#292e42] text-gray-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metadata Specs Table */}
                  <div className="bg-[#12131a] border border-[#212433] rounded-2xl p-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>Cryptographic & Technical Specifications</span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-gray-500 block text-[10px]">FILE SIZE</span>
                        <span className="text-white font-medium">{formatBytes(file.fileSizeBytes)}</span>
                      </div>

                      {file.metadata?.resolution && (
                        <div>
                          <span className="text-gray-500 block text-[10px]">RESOLUTION</span>
                          <span className="text-purple-300 font-semibold">{file.metadata.resolution}</span>
                        </div>
                      )}

                      {file.metadata?.codec && (
                        <div>
                          <span className="text-gray-500 block text-[10px]">CODEC / CONTAINER</span>
                          <span className="text-white font-medium">{file.metadata.codec}</span>
                        </div>
                      )}

                      <div>
                        <span className="text-gray-500 block text-[10px]">UPLOAD DATE</span>
                        <span className="text-gray-300">{formatDate(file.createdAt)}</span>
                      </div>

                      <div>
                        <span className="text-gray-500 block text-[10px]">TOTAL VIEWS</span>
                        <span className="text-gray-300">{file.viewsCount}</span>
                      </div>

                      <div>
                        <span className="text-gray-500 block text-[10px]">DOWNLOADS</span>
                        <span className="text-gray-300">{file.downloadsCount}</span>
                      </div>
                    </div>

                    {file.metadata?.sha256 && (
                      <div className="mt-4 pt-3 border-t border-[#1e2230]">
                        <span className="text-[10px] text-gray-500 font-mono block mb-1">SHA-256 HASH VERIFICATION</span>
                        <p className="text-[11px] font-mono text-emerald-400 break-all select-all bg-[#0a0b0e] p-2 rounded-lg border border-[#1b1e2c]">
                          {file.metadata.sha256}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="bg-[#12131a] border border-[#212433] rounded-2xl p-6 space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Community Discussion ({comments.length})
                    </h3>

                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={user ? "Write a comment..." : "Sign in to leave a comment"}
                        disabled={!user || isSubmittingComment}
                        className="flex-1 px-3.5 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none transition"
                      />
                      <button
                        type="submit"
                        disabled={!user || !newComment.trim() || isSubmittingComment}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post</span>
                      </button>
                    </form>

                    <div className="space-y-3 pt-2">
                      {comments.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-2">
                          No comments yet. Be the first to share your thoughts!
                        </p>
                      ) : (
                        comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-3 bg-[#161824] border border-[#232637] rounded-xl flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-2.5">
                              {comment.userAvatar ? (
                                <img
                                  src={comment.userAvatar}
                                  alt={comment.username}
                                  className="w-7 h-7 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-purple-900/60 flex items-center justify-center text-[10px] font-bold text-purple-200 shrink-0">
                                  {comment.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-200">
                                    {comment.username}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-mono">
                                    {formatRelativeTime(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-300 mt-1">{comment.content}</p>
                              </div>
                            </div>

                            {(user?.id === comment.userId || isAdmin) && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-500 hover:text-rose-400 p-1 transition"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right col: Ten Star Rating & Uploader Info */}
                <div className="space-y-6">
                  {/* Uploader Card */}
                  <div className="bg-[#12131a] border border-[#212433] rounded-2xl p-5">
                    <span className="text-[10px] uppercase font-mono text-gray-500 font-semibold block mb-3">
                      UPLOADED BY
                    </span>
                    <div className="flex items-center gap-3">
                      {file.uploaderAvatar ? (
                        <img
                          src={file.uploaderAvatar}
                          alt={file.uploaderName}
                          className="w-10 h-10 rounded-full object-cover border border-purple-500/30"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-900/60 flex items-center justify-center font-bold text-purple-200">
                          {file.uploaderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white">{file.uploaderName}</h4>
                        <span className="text-[11px] text-purple-400">Verified Contributor</span>
                      </div>
                    </div>
                  </div>

                  {/* 10-Star Rating Component */}
                  <TenStarRating
                    fileId={file.id}
                    ratingAverage={file.ratingAverage}
                    ratingCount={file.ratingCount}
                    initialUserRating={userRating}
                    ratingDistribution={file.ratingDistribution}
                    onRatingUpdated={handleRatingUpdated}
                    onRequireLogin={onRequireLogin}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
