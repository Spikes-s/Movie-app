import React, { useState, useEffect, useRef } from 'react';
import {
  Link as LinkIcon,
  Download,
  Film,
  Music,
  Sparkles,
  Clipboard,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  FolderPlus,
  Share2,
  Clock,
  ArrowRight,
  Zap,
  Globe,
  Trash2,
  ExternalLink,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDuration } from '../utils/formatters';

interface LinkConverterViewProps {
  onOpenAuth: () => void;
  onNavigateToVault?: () => void;
}

export const LinkConverterView: React.FC<LinkConverterViewProps> = ({ onOpenAuth, onNavigateToVault }) => {
  const { user } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [targetFormat, setTargetFormat] = useState<'video' | 'audio'>('video');
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedMedia, setExtractedMedia] = useState<any | null>(null);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [recentConversions, setRecentConversions] = useState<any[]>([]);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Video preview player gesture states
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [gestureHUD, setGestureHUD] = useState<{ type: string; text: string; value?: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number; side: 'left' | 'right'; startVolume: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rewindIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingVolumeRef = useRef(false);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent conversions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ghostshare_recent_conversions');
      if (stored) {
        setRecentConversions(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const saveRecent = (item: any) => {
    try {
      const updated = [item, ...recentConversions.filter(c => c.originalUrl !== item.originalUrl)].slice(0, 8);
      setRecentConversions(updated);
      localStorage.setItem('ghostshare_recent_conversions', JSON.stringify(updated));
    } catch (e) {}
  };

  const clearRecent = () => {
    setRecentConversions([]);
    localStorage.removeItem('ghostshare_recent_conversions');
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        setErrorMessage(null);
      }
    } catch (err) {
      setErrorMessage('Could not read from clipboard. Please paste manually.');
    }
  };

  const handleConvert = async (overrideUrl?: string) => {
    const urlToProcess = (overrideUrl || urlInput).trim();
    if (!urlToProcess) {
      setErrorMessage('Please paste or enter a valid video link.');
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);
    setSavedSuccessMsg(null);

    try {
      const res = await api.extractMedia(urlToProcess);
      setExtractedMedia(res.mediaInfo);
      saveRecent(res.mediaInfo);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to extract media from this URL. Please verify the link.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveToVault = async (format: 'mp4' | 'mp3', quality: string) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!extractedMedia) return;

    setIsSavingToVault(true);
    try {
      await api.saveConvertedToVault({
        title: extractedMedia.title,
        thumbnailUrl: extractedMedia.thumbnailUrl,
        originalUrl: extractedMedia.originalUrl,
        format,
        quality
      });
      setSavedSuccessMsg(`Saved to your GhostShare Vault as ${format.toUpperCase()}!`);
      setTimeout(() => setSavedSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not save to vault.');
    } finally {
      setIsSavingToVault(false);
    }
  };

  // Video player gesture handlers (drag volume, hold 2x speed, hold rewind)
  const triggerHUD = (type: string, text: string, value?: number) => {
    setGestureHUD({ type, text, value });
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setGestureHUD(null), 1400);
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

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (!videoRef.current) return;
      if (side === 'right') {
        videoRef.current.playbackRate = 2.0;
        triggerHUD('speed', '2X Speed Boost >>');
      } else {
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
    const deltaY = pointerStartRef.current.y - currentY;

    if (pointerStartRef.current.side === 'right' && Math.abs(deltaY) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      isDraggingVolumeRef.current = true;
      const volumeChange = (deltaY / (rect.height * 0.6)) * 1.2;
      const newVol = Math.max(0, Math.min(1, pointerStartRef.current.startVolume + volumeChange));
      videoRef.current.volume = newVol;
      setVideoVolume(newVol);
      triggerHUD('volume', `Volume ${Math.round(newVol * 100)}%`, newVol);
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (rewindIntervalRef.current) clearInterval(rewindIntervalRef.current);

    if (videoRef.current && videoRef.current.playbackRate !== playbackSpeed) {
      videoRef.current.playbackRate = playbackSpeed;
      triggerHUD('speed', `Speed ${playbackSpeed}x`);
    }

    if (pointerStartRef.current && !isDraggingVolumeRef.current) {
      const elapsed = Date.now() - pointerStartRef.current.time;
      if (elapsed < 300) {
        toggleVideoPlay();
      }
    }

    pointerStartRef.current = null;
    isDraggingVolumeRef.current = false;
  };

  const exampleLinks = [
    { label: 'TikTok (No Watermark)', url: 'https://www.tiktok.com/@creator/video/7345678901234567890' },
    { label: 'YouTube 4K/FHD', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { label: 'Instagram Reel', url: 'https://www.instagram.com/reel/C8xyz123abc/' },
    { label: 'Direct MP4 Stream', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }
  ];

  return (
    <div className="space-y-10 pb-28">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden border border-[#23273a] bg-gradient-to-r from-[#141224] via-[#10111a] to-[#0c0d13] p-6 sm:p-12 text-center shadow-2xl">
        <div className="absolute inset-0 bg-radial-at-t from-purple-800/25 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-[11px] font-mono font-bold text-purple-300 mb-4 shadow">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>UNIVERSAL WATERMARK-FREE LINK EXTRACTOR</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-3">
            Paste Link. <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Get Clean MP4 & MP3.</span>
          </h1>

          <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto mb-8 leading-relaxed">
            Recover original videos without watermarks from TikTok, YouTube, Instagram Reels, Twitter/X, Reddit, and direct media streams. Convert into high-bitrate MP4 or lossless MP3 audio.
          </p>

          {/* Converter Search Input Box */}
          <div className="p-2 sm:p-3 bg-[#0d0e14]/90 backdrop-blur-xl border-2 border-purple-500/50 rounded-3xl shadow-2xl shadow-purple-950/60 max-w-2xl mx-auto">
            {/* Format toggle pills */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <button
                type="button"
                onClick={() => setTargetFormat('video')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  targetFormat === 'video'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white bg-[#161824]'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>MP4 Video (No Watermark)</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetFormat('audio')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  targetFormat === 'audio'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white bg-[#161824]'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>MP3 Audio Only</span>
              </button>
            </div>

            {/* Input + Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                  placeholder="Paste TikTok, YouTube, Reels, or video link here..."
                  className="w-full pl-11 pr-20 py-3.5 bg-[#141622] border border-[#232738] focus:border-purple-400 rounded-2xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none transition shadow-inner"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {urlInput ? (
                    <button
                      type="button"
                      onClick={() => setUrlInput('')}
                      className="p-1.5 text-gray-400 hover:text-white rounded-lg transition"
                      title="Clear"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2.5 py-1 bg-[#1e2232] hover:bg-[#282d42] border border-[#2b3046] text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                      title="Paste from clipboard"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isExtracting || !urlInput.trim()}
                onClick={() => handleConvert()}
                className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xl shadow-purple-900/40 transition transform hover:scale-102 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Convert Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Link Tryouts */}
            <div className="mt-3 pt-2.5 border-t border-[#1a1d2c] flex items-center justify-start gap-1.5 overflow-x-auto scrollbar-none px-1">
              <span className="text-[10px] font-mono text-gray-500 uppercase mr-1">TRY:</span>
              {exampleLinks.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setUrlInput(ex.url);
                    handleConvert(ex.url);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#161824] hover:bg-[#1f2232] border border-[#242838] text-[11px] text-gray-300 hover:text-white transition whitespace-nowrap"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 max-w-lg mx-auto bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-center gap-2.5 text-xs text-rose-300 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* EXTRACTED MEDIA RESULT SECTION */}
      {extractedMedia && (
        <div className="max-w-4xl mx-auto bg-[#11121b] border-2 border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl animate-fade-in space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1f2230]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-purple-950 border border-purple-700/60 text-purple-300 text-[10px] font-mono font-bold uppercase">
                  {extractedMedia.platform}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>No Watermark</span>
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{extractedMedia.title}</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Author: {extractedMedia.author}</p>
            </div>

            <button
              type="button"
              onClick={() => handleSaveToVault(targetFormat === 'audio' ? 'mp3' : 'mp4', targetFormat === 'audio' ? '320kbps' : '1080p FHD')}
              disabled={isSavingToVault}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{isSavingToVault ? 'Saving...' : 'Save to GhostShare Vault'}</span>
            </button>
          </div>

          {savedSuccessMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{savedSuccessMsg}</span>
            </div>
          )}

          {/* Interactive Player Preview with Full Gesture Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Left: Video Preview with custom drag volume & speed boost gestures */}
            <div
              ref={videoContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-[#232738] shadow-2xl group select-none touch-none cursor-pointer"
            >
              <video
                ref={videoRef}
                src="/api/converter/stream?format=mp4"
                playsInline
                poster={extractedMedia.thumbnailUrl}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Large Center Play Button */}
              {!isVideoPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all pointer-events-none">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVideoPlay();
                    }}
                    className="pointer-events-auto w-16 h-16 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white flex items-center justify-center shadow-2xl border-2 border-white/20 transform transition hover:scale-110 active:scale-95"
                    title="Play Preview"
                  >
                    <Play className="w-8 h-8 fill-white ml-1" />
                  </button>
                </div>
              )}

              {/* Gesture HUD Feedback */}
              {gestureHUD && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  {gestureHUD.type === 'volume' && (
                    <div className="bg-black/85 backdrop-blur-md px-4 py-3 rounded-2xl border border-purple-500/40 shadow-2xl flex flex-col items-center gap-1.5 min-w-[150px]">
                      <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                        {(gestureHUD.value ?? 1) === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                        <span>{gestureHUD.text}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full"
                          style={{ width: `${Math.round((gestureHUD.value ?? 1) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {gestureHUD.type === 'speed' && (
                    <div className="bg-purple-950/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-purple-400/60 shadow-2xl flex items-center gap-2 text-white font-extrabold text-xs">
                      <FastForward className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>{gestureHUD.text}</span>
                    </div>
                  )}

                  {gestureHUD.type === 'rewind' && (
                    <div className="bg-cyan-950/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-cyan-400/60 shadow-2xl flex items-center gap-2 text-white font-extrabold text-xs">
                      <Rewind className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                      <span>{gestureHUD.text}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Gesture Hint Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 text-center text-[10px] font-mono text-gray-300">
                <span>Hold Left: Rewind • Hold Right: 2x • Drag Right: Volume</span>
              </div>
            </div>

            {/* Right: Available Download Formats (MP4 & MP3) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Available Watermark-Free Downloads
              </h3>

              <div className="space-y-2">
                {extractedMedia.formats?.map((fmt: any) => (
                  <div
                    key={fmt.id}
                    className="p-3 bg-[#151722] border border-[#232737] hover:border-purple-500/40 rounded-xl flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        fmt.type === 'video' ? 'bg-purple-950 text-purple-400' : 'bg-emerald-950 text-emerald-400'
                      }`}>
                        {fmt.type === 'video' ? <Film className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{fmt.quality}</span>
                          <span className="text-[9px] font-mono px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                            {fmt.format.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">{fmt.estimatedSize} • Direct File</p>
                      </div>
                    </div>

                    <a
                      href={fmt.downloadUrl}
                      download
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Conversions History */}
      {recentConversions.length > 0 && (
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Recent Converted Media</span>
            </h3>
            <button
              onClick={clearRecent}
              className="text-xs text-gray-500 hover:text-rose-400 transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {recentConversions.map((rec, i) => (
              <div
                key={i}
                onClick={() => setExtractedMedia(rec)}
                className="p-3 bg-[#12131a] border border-[#212433] hover:border-purple-500/50 rounded-2xl cursor-pointer transition flex flex-col justify-between group"
              >
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black mb-2 relative">
                  <img
                    src={rec.thumbnailUrl}
                    alt={rec.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/80 text-purple-300">
                    {rec.platform}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-gray-200 group-hover:text-purple-300 transition line-clamp-1 mb-1">
                  {rec.title}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>No Watermark</span>
                  <span className="text-purple-400 group-hover:translate-x-0.5 transition">View & DL →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported Platforms Banner (SilvaTechs style) */}
      <div className="max-w-4xl mx-auto pt-4 pb-2 border-t border-[#1c1f2e]">
        <div className="text-center mb-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-purple-400 font-bold">
            SUPPORTED PLATFORMS • 100% CLEAN EXTRACTION
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {[
            { name: 'TikTok', tag: 'No Watermark', color: 'from-pink-500 to-rose-600' },
            { name: 'YouTube', tag: '4K/1080p', color: 'from-red-600 to-rose-700' },
            { name: 'Instagram Reels', tag: 'HD Video', color: 'from-purple-600 to-pink-500' },
            { name: 'Twitter / X', tag: 'Direct MP4', color: 'from-sky-500 to-blue-600' },
            { name: 'Facebook', tag: 'HD Clip', color: 'from-blue-600 to-indigo-700' },
            { name: 'Reddit', tag: 'Audio+Video', color: 'from-orange-500 to-red-600' },
            { name: 'Pinterest', tag: 'Video Pin', color: 'from-red-500 to-pink-600' },
            { name: 'Threads', tag: 'Clean Clip', color: 'from-zinc-400 to-zinc-600' },
            { name: 'Vimeo', tag: 'High-Bitrate', color: 'from-cyan-500 to-blue-500' }
          ].map((item, idx) => (
            <div
              key={idx}
              className="px-3 py-1.5 rounded-xl bg-[#13151f] border border-[#222636] flex items-center gap-2 shadow-sm"
            >
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${item.color}`} />
              <span className="text-xs font-bold text-gray-200">{item.name}</span>
              <span className="text-[9px] font-mono px-1 rounded bg-[#1c1f2e] text-purple-300">
                {item.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Step Guide (How to download videos without watermark) */}
      <div className="max-w-4xl mx-auto space-y-4 pt-4">
        <div className="text-center">
          <h3 className="text-base sm:text-xl font-black text-white">
            How to Recover & Convert Videos Without Watermark
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Fast, free, and unlimited in 3 straightforward steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-5 bg-[#12141e] border border-[#232738] rounded-2xl space-y-2 relative">
            <span className="text-3xl font-black text-purple-500/30 absolute right-4 top-4">01</span>
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-700/50 flex items-center justify-center text-purple-300 text-xs font-bold">
              <LinkIcon className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white">Copy the Video URL</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Open TikTok, YouTube, Instagram Reels, or X. Click Share &gt; Copy Link to grab the original post URL.
            </p>
          </div>

          <div className="p-5 bg-[#12141e] border border-[#232738] rounded-2xl space-y-2 relative">
            <span className="text-3xl font-black text-purple-500/30 absolute right-4 top-4">02</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-300 text-xs font-bold">
              <Clipboard className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white">Paste & Select Format</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Paste your link in the input box above. Choose MP4 Video (1080p/720p/480p) or MP3 Audio Only (320kbps).
            </p>
          </div>

          <div className="p-5 bg-[#12141e] border border-[#232738] rounded-2xl space-y-2 relative">
            <span className="text-3xl font-black text-purple-500/30 absolute right-4 top-4">03</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-300 text-xs font-bold">
              <Download className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white">Download Clean File</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Hit "Convert Link" to extract the unwatermarked stream. Download to your device or save directly to your Vault.
            </p>
          </div>
        </div>
      </div>

      {/* Guide & Capabilities Section (inspired by downloader.silvatechs.com) */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4">
        <div className="p-5 bg-[#12141e] border border-[#232738] rounded-2xl space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">100% Watermark-Free</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Directly extracts the raw underlying video streams without logos, creator stamps, or compression artifacts.
          </p>
        </div>

        <div className="p-5 bg-[#12141e] border border-[#232738] rounded-2xl space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Music className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">MP4 & MP3 Audio Extraction</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Convert video links into pristine 320kbps MP3 audio tracks or 1080p Full HD MP4 files with a single click.
          </p>
        </div>

        <div className="p-5 bg-[#12141e] border border-[#232738] rounded-2xl space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Globe className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">Universal Platform Support</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Compatible with TikTok, YouTube, Instagram Reels, Twitter/X, Reddit, Facebook, Vimeo, and direct M3U8/MP4 streams.
          </p>
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="max-w-4xl mx-auto space-y-3 pt-6 border-t border-[#1c1f2e]">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            Frequently Asked Questions (FAQ)
          </h3>
        </div>

        {[
          {
            q: 'How does GhostShare remove watermarks from TikTok and Instagram Reels?',
            a: 'Our converter accesses the direct CDN master stream before the platform applies their dynamic overlay stamps and user ID watermarks. This ensures you receive the original video quality with zero stamps or logos.'
          },
          {
            q: 'Can I convert any video link directly into an MP3 audio file?',
            a: 'Yes! Toggle the format switch to "MP3 Audio Only" before or after pasting the link. GhostShare will automatically extract the high-fidelity audio track at 320kbps studio bitrate or 128kbps standard bitrate.'
          },
          {
            q: 'What video resolutions are available for download?',
            a: 'Depending on the source video, you can download in 1080p Full HD, 720p HD, and 480p SD. All video files are standard MP4 with H.264/AAC for universal compatibility on phones, tablets, and computers.'
          },
          {
            q: 'How do the video player gesture controls work on the preview?',
            a: 'The preview player supports interactive gestures: Drag up or down on the right side of the video to smoothly adjust volume; Long-press on the right side to speed up playback to 2x; Long-press on the left side to rewind and jump backwards.'
          },
          {
            q: 'Is there any limit to the number of links I can convert?',
            a: 'No, GhostShare provides unlimited watermark-free link conversions and downloads with no subscription fees or annoying watermarks.'
          }
        ].map((faq, i) => {
          const isOpen = openFaqIndex === i;
          return (
            <div
              key={i}
              className="bg-[#12141f] border border-[#212435] rounded-xl overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-gray-200 hover:text-white transition"
              >
                <span>{faq.q}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-purple-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-3.5 pb-3.5 text-[11px] text-gray-400 leading-relaxed border-t border-[#1b1e2c] pt-2.5">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
