import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  X,
  Music
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { formatDuration } from '../utils/formatters';

export const AudioPlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    nextTrack,
    prevTrack,
    closePlayer
  } = useAudio();

  if (!currentTrack) return null;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0e14]/95 backdrop-blur-xl border-t border-[#1e2230] px-4 py-3 shadow-2xl animate-slide-up">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-full sm:w-1/4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 overflow-hidden shrink-0 flex items-center justify-center">
            {currentTrack.thumbnailUrl ? (
              <img
                src={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="w-5 h-5 text-purple-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">{currentTrack.title}</h4>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{currentTrack.uploaderName}</p>
          </div>
        </div>

        {/* Center Controls & Scrubber */}
        <div className="flex flex-col items-center w-full sm:w-2/4 max-w-xl">
          <div className="flex items-center gap-4 mb-1">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-lg transition ${
                isShuffled ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={prevTrack}
              className="p-1.5 text-gray-400 hover:text-white transition"
              title="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg shadow-purple-900/30 transition transform hover:scale-105"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="p-1.5 text-gray-400 hover:text-white transition"
              title="Next"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-1.5 rounded-lg transition ${
                repeatMode !== 'off' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Time scrubber */}
          <div className="w-full flex items-center gap-2 text-[10px] font-mono text-gray-400">
            <span className="w-8 text-right">{formatDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={handleSeekChange}
              className="flex-1 h-1 bg-[#232738] accent-purple-500 rounded-lg cursor-pointer"
            />
            <span className="w-8">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Right side: Volume & Close */}
        <div className="flex items-center justify-end gap-3 w-full sm:w-1/4">
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white transition">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-[#232738] accent-purple-500 rounded-lg cursor-pointer"
            />
          </div>

          <button
            onClick={closePlayer}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-[#1c1f2c] transition"
            title="Close Player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
