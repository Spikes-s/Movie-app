import React, { useState } from 'react';
import {
  Shield,
  Upload,
  Download,
  FolderLock,
  Search,
  User as UserIcon,
  LogOut,
  Sparkles,
  ChevronDown,
  Zap,
  Film,
  Music,
  FileText,
  Grid,
  Heart,
  Layers,
  Settings,
  Menu,
  X,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavigationTab =
  | 'discovery'
  | 'videos'
  | 'music'
  | 'documents'
  | 'browse'
  | 'converter'
  | 'downloads'
  | 'library'
  | 'favorites'
  | 'collections'
  | 'profile'
  | 'settings'
  | 'admin';

interface NavbarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenUpload: () => void;
  onOpenAuth: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenUpload,
  onOpenAuth,
  searchQuery,
  onSearchChange
}) => {
  const { user, isAdmin, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleTabClick = (tab: NavigationTab) => {
    if ((tab === 'library' || tab === 'favorites' || tab === 'collections' || tab === 'profile') && !user) {
      onOpenAuth();
      return;
    }
    if (tab === 'admin' && !isAdmin) {
      onOpenAuth();
      return;
    }
    onTabChange(tab);
    setShowMobileMenu(false);
    setShowUserDropdown(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0b0c11]/95 backdrop-blur-xl border-b border-[#1b1e2c]">
      {/* Primary Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Logo & Name */}
        <div
          onClick={() => handleTabClick('discovery')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform border border-purple-400/30">
            <FolderLock className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white group-hover:text-purple-300 transition-colors">
                VaultShare
              </span>
              <span className="text-[9px] font-black tracking-widest px-1.5 py-0.2 rounded bg-purple-950/90 border border-purple-700/50 text-purple-300">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-gray-400 hidden sm:block">Digital Sharing & Storage</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search 8K/4K media, master tracks, documents, or tags..."
              className="w-full pl-10 pr-4 py-2 bg-[#141620] border border-[#222636] focus:border-purple-500/70 rounded-2xl text-xs text-white placeholder-gray-500 focus:outline-none transition shadow-inner"
            />
          </div>
        </div>

        {/* Desktop Primary Nav Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => handleTabClick('discovery')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentTab === 'discovery'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            Discover
          </button>

          <button
            onClick={() => handleTabClick('videos')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'videos'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-rose-400" />
            <span>Videos</span>
          </button>

          <button
            onClick={() => handleTabClick('music')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'music'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-purple-400" />
            <span>Music</span>
          </button>

          <button
            onClick={() => handleTabClick('documents')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'documents'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Documents</span>
          </button>

          <button
            onClick={() => handleTabClick('converter')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'converter'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Downloader</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              HD Media
            </span>
          </button>

          <button
            onClick={() => handleTabClick('library')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'library' || currentTab === 'favorites' || currentTab === 'collections'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <FolderLock className="w-3.5 h-3.5 text-indigo-400" />
            <span>My Library</span>
          </button>

          <button
            onClick={() => handleTabClick('downloads')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'downloads'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Downloads</span>
          </button>

          <button
            onClick={() => handleTabClick('settings')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'settings'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-gray-400" />
            <span>Settings</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => handleTabClick('admin')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                currentTab === 'admin'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40 shadow-md'
                  : 'text-rose-400 hover:bg-rose-950/30 border border-rose-900/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5 fill-rose-500/20" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Action Controls: Upload & User Profile */}
        <div className="flex items-center gap-2">
          {/* Upload Button */}
          <button
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                onOpenUpload();
              }
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-1.5 transition transform hover:scale-102 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* User Profile Dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 p-1 pl-2 bg-[#151722] hover:bg-[#1d2030] rounded-xl border border-[#25293a] transition"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-6 h-6 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-purple-900/70 text-[11px] font-bold text-purple-200 flex items-center justify-center">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-gray-200 max-w-[90px] truncate hidden sm:inline">
                  {user.username}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {showUserDropdown && (
                <div
                  onMouseLeave={() => setShowUserDropdown(false)}
                  className="absolute right-0 mt-2 w-56 bg-[#12141e] border border-[#232738] rounded-2xl p-2 shadow-2xl z-50 animate-fade-in"
                >
                  <div className="px-3 py-2 border-b border-[#1f2230] mb-1">
                    <p className="text-xs font-bold text-white truncate">{user.username}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                    {isAdmin && (
                      <span className="inline-block mt-1 text-[9px] font-black uppercase font-mono px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                        Primary Administrator
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleTabClick('profile')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span>My Profile & Quota</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('library')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <FolderLock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>My Library</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('favorites')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>Favorites</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('collections')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Collections</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('downloads')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Downloads History</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('settings')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-400" />
                    <span>Settings & Cloud R2</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleTabClick('admin')}
                      className="w-full text-left px-3 py-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded-lg transition flex items-center gap-2"
                    >
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      <span>Admin Console</span>
                    </button>
                  )}

                  <div className="pt-1 mt-1 border-t border-[#1f2230]">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 bg-[#171924] hover:bg-[#202334] border border-[#272b3c] text-gray-200 hover:text-white text-xs font-semibold rounded-xl transition"
            >
              Sign In
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 text-gray-400 hover:text-white bg-[#141620] border border-[#222636] rounded-xl transition"
          >
            {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Secondary Bar (Desktop: Category quick filters) */}
      <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 py-1.5 border-t border-[#161824] text-[11px] text-gray-400">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleTabClick('browse')}
            className={`hover:text-purple-300 transition flex items-center gap-1 ${currentTab === 'browse' ? 'text-purple-400 font-bold' : ''}`}
          >
            <Grid className="w-3 h-3" />
            <span>Browse All Files</span>
          </button>
          <span className="text-[#202436]">•</span>
          <button
            onClick={() => handleTabClick('videos')}
            className={`hover:text-purple-300 transition flex items-center gap-1 ${currentTab === 'videos' ? 'text-purple-400 font-bold' : ''}`}
          >
            <span>8K/4K/HD Videos</span>
          </button>
          <span className="text-[#202436]">•</span>
          <button
            onClick={() => handleTabClick('music')}
            className={`hover:text-purple-300 transition flex items-center gap-1 ${currentTab === 'music' ? 'text-purple-400 font-bold' : ''}`}
          >
            <span>Lossless Audio</span>
          </button>
          <span className="text-[#202436]">•</span>
          <button
            onClick={() => handleTabClick('documents')}
            className={`hover:text-purple-300 transition flex items-center gap-1 ${currentTab === 'documents' ? 'text-purple-400 font-bold' : ''}`}
          >
            <span>Documents & PDF</span>
          </button>
          <span className="text-[#202436]">•</span>
          <button
            onClick={() => handleTabClick('favorites')}
            className={`hover:text-purple-300 transition flex items-center gap-1 ${currentTab === 'favorites' ? 'text-purple-400 font-bold' : ''}`}
          >
            <Heart className="w-3 h-3 text-rose-400" />
            <span>Favorites</span>
          </button>
          <span className="text-[#202436]">•</span>
          <button
            onClick={() => handleTabClick('collections')}
            className={`hover:text-purple-300 transition flex items-center gap-1 ${currentTab === 'collections' ? 'text-purple-400 font-bold' : ''}`}
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>Collections</span>
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-gray-500">
          <span>Max File: 10 GB</span>
          <span>•</span>
          <span>Cloudflare R2 + Supabase RLS</span>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {showMobileMenu && (
        <div className="lg:hidden bg-[#0d0e15] border-b border-[#1b1e2c] px-4 py-3 space-y-2 animate-fade-in">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#141620] border border-[#222636] rounded-xl text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => handleTabClick('discovery')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'discovery' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Discover</span>
            </button>

            <button
              onClick={() => handleTabClick('videos')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'videos' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Videos</span>
            </button>

            <button
              onClick={() => handleTabClick('music')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'music' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Music</span>
            </button>

            <button
              onClick={() => handleTabClick('documents')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'documents' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </button>

            <button
              onClick={() => handleTabClick('browse')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'browse' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Browse All</span>
            </button>

            <button
              onClick={() => handleTabClick('converter')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'converter' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Media Downloader</span>
            </button>

            <button
              onClick={() => handleTabClick('library')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'library' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <FolderLock className="w-4 h-4 text-indigo-400" />
              <span>My Library</span>
            </button>

            <button
              onClick={() => handleTabClick('downloads')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'downloads' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Downloads</span>
            </button>

            <button
              onClick={() => handleTabClick('favorites')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'favorites' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Favorites</span>
            </button>

            <button
              onClick={() => handleTabClick('collections')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'collections' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Collections</span>
            </button>

            <button
              onClick={() => handleTabClick('profile')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'profile' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <UserIcon className="w-4 h-4 text-purple-400" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => handleTabClick('settings')}
              className={`p-2 rounded-xl text-left font-semibold flex items-center gap-2 ${
                currentTab === 'settings' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-[#161824]'
              }`}
            >
              <Settings className="w-4 h-4 text-gray-400" />
              <span>Settings</span>
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => handleTabClick('admin')}
              className="w-full mt-2 p-2 rounded-xl text-left font-bold text-xs bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Console</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
