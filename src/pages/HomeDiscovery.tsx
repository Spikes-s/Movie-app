import React, { useState, useEffect } from 'react';
import {
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Archive,
  Terminal,
  Sparkles,
  TrendingUp,
  Star,
  Download,
  Filter,
  Flame,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { FileItem } from '../types';
import { api } from '../services/api';
import { FileCard } from '../components/FileCard';

interface HomeDiscoveryProps {
  searchQuery: string;
  onSelectFile: (file: FileItem) => void;
  onShareFile: (file: FileItem) => void;
  onOpenUpload: () => void;
  initialCategory?: string;
  hideHero?: boolean;
}

export const HomeDiscovery: React.FC<HomeDiscoveryProps> = ({
  searchQuery,
  onSelectFile,
  onShareFile,
  onOpenUpload,
  initialCategory,
  hideHero = false
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedResolution, setSelectedResolution] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<string>('trending');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const res = await api.getFiles({
        search: searchQuery,
        category: selectedCategory,
        sort: selectedSort,
        resolution: selectedResolution,
        limit: 30
      });
      setFiles(res.files);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [searchQuery, selectedCategory, selectedResolution, selectedSort]);

  const categories = [
    { id: 'all', label: 'All Files', icon: Sparkles },
    { id: 'video', label: '4K & 8K Videos', icon: Film },
    { id: 'audio', label: 'Lossless Audio', icon: Music },
    { id: 'image', label: 'Photography', icon: ImageIcon },
    { id: 'document', label: 'Documents', icon: FileText },
    { id: 'archive', label: 'Archives & ZIP', icon: Archive },
    { id: 'software', label: 'Software & Code', icon: Terminal }
  ];

  // Spotlight file for the hero header (e.g. 8K Cosmos or first video)
  const spotlightFile = files.find(f => f.metadata?.resolution?.includes('8K')) || files[0];

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Showcase Spotlight */}
      {!searchQuery && !hideHero && spotlightFile && (
        <div className="relative rounded-3xl overflow-hidden border border-[#23273a] bg-gradient-to-r from-[#12131e] via-[#10111a] to-[#0a0a0f] p-6 sm:p-10 shadow-2xl">
          <div className="absolute inset-0 bg-radial-at-tr from-purple-900/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-[10px] font-black uppercase tracking-wider text-purple-300">
                FEATURED RELEASE
              </span>
              {spotlightFile.metadata?.resolution && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider text-rose-300">
                  {spotlightFile.metadata.resolution}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              {spotlightFile.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 mb-6">
              {spotlightFile.description}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectFile(spotlightFile)}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-2 transition transform hover:scale-102"
              >
                <Sparkles className="w-4 h-4" />
                <span>Stream & Inspect</span>
              </button>

              <button
                onClick={onOpenUpload}
                className="px-5 py-2.5 bg-[#181a26] hover:bg-[#202334] border border-[#2b2f42] text-gray-200 hover:text-white text-xs font-semibold rounded-xl transition"
              >
                Upload High-Res Media
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Controls Bar */}
      <div className="space-y-4">
        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                    : 'bg-[#13141d] border border-[#202434] text-gray-400 hover:text-white hover:bg-[#1a1c28]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Resolution Quick Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-mono text-gray-500 font-medium mr-1">RESOLUTION:</span>
            {[
              { id: '', label: 'All' },
              { id: '8k', label: '8K' },
              { id: '4k', label: '4K' },
              { id: '1080p', label: '1080p' },
              { id: '720p', label: '720p' },
              { id: '480p', label: '480p' },
              { id: 'hd', label: 'HD' }
            ].map((res) => {
              const isSelected = (selectedResolution === '' && res.id === '') || (selectedResolution.toLowerCase() === res.id.toLowerCase());
              return (
                <button
                  key={res.id || 'all'}
                  type="button"
                  onClick={() => setSelectedResolution(isSelected && res.id !== '' ? '' : res.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border whitespace-nowrap ${
                    isSelected
                      ? 'bg-purple-950 border-purple-500 text-purple-300 shadow-sm'
                      : 'bg-[#13141d] border-[#222636] text-gray-400 hover:text-white'
                  }`}
                >
                  {res.label}
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-gray-500 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              <span>SORT:</span>
            </span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="px-3 py-1 bg-[#13141d] border border-[#222636] focus:border-purple-500 text-xs text-white rounded-xl focus:outline-none transition cursor-pointer"
            >
              <option value="trending">Trending & Popular</option>
              <option value="rating">Highest Rated (10★)</option>
              <option value="downloads">Most Downloaded</option>
              <option value="views">Most Viewed</option>
              <option value="newest">Recently Uploaded</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Files */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#12131a] border border-[#202330] rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="aspect-video bg-[#1a1c27] rounded-xl" />
              <div className="h-4 bg-[#1a1c27] rounded w-3/4" />
              <div className="h-3 bg-[#1a1c27] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-[#232738] rounded-3xl bg-[#0f1017]">
          <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">No media files found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
            Try adjusting your search criteria or be the first to upload high-resolution media!
          </p>
          <button
            onClick={onOpenUpload}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            Upload to GhostShare
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onSelect={onSelectFile}
              onShare={onShareFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};
