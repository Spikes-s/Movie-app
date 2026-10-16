import React, { useState } from 'react';
import {
  Shield,
  Ghost,
  Upload,
  Download,
  FolderLock,
  Search,
  User,
  LogOut,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: 'discovery' | 'converter' | 'downloads' | 'library' | 'admin';
  onTabChange: (tab: 'discovery' | 'converter' | 'downloads' | 'library' | 'admin') => void;
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

  return (
    <header className="sticky top-0 z-30 bg-[#0b0c11]/90 backdrop-blur-xl border-b border-[#1b1e2c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => onTabChange('discovery')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform border border-purple-400/30">
            <Ghost className="w-5 h-5 fill-white/20 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white group-hover:text-purple-300 transition-colors">
                GhostShare
              </span>
              <span className="text-[9px] font-black tracking-widest px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/40 text-purple-400">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-gray-400 hidden sm:block">Stealth 8K/4K/HD Media</p>
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
              placeholder="Search 8K videos, master tracks, archives, or tags..."
              className="w-full pl-10 pr-4 py-2 bg-[#141620] border border-[#222636] focus:border-purple-500/70 rounded-2xl text-xs text-white placeholder-gray-500 focus:outline-none transition shadow-inner"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5">
          <button
            onClick={() => onTabChange('discovery')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentTab === 'discovery'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            Discovery
          </button>

          <button
            onClick={() => onTabChange('converter')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'converter'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Converter</span>
            <span className="hidden sm:inline text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              No-WM
            </span>
          </button>

          <button
            onClick={() => onTabChange('downloads')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'downloads'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Downloads</span>
          </button>

          <button
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                onTabChange('library');
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              currentTab === 'library'
                ? 'bg-[#1e2232] text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-[#141620]'
            }`}
          >
            <FolderLock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Vault</span>
          </button>

          {/* Admin Dashboard Tab (Prominently displayed for spikesprimo6625@gmail.com) */}
          {isAdmin && (
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                currentTab === 'admin'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40 shadow-md'
                  : 'text-rose-400 hover:bg-rose-950/30 border border-rose-900/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5 fill-rose-500/20" />
              <span>Admin Console</span>
            </button>
          )}
        </nav>

        {/* Action Controls: Upload & User */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                onOpenUpload();
              }
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-1.5 transition transform hover:scale-102"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

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

              {/* User Dropdown */}
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
                    onClick={() => {
                      onTabChange('library');
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <FolderLock className="w-3.5 h-3.5 text-purple-400" />
                    <span>My Uploads & Vault</span>
                  </button>

                  <button
                    onClick={() => {
                      onTabChange('downloads');
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#1a1d2c] rounded-lg transition flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download History</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        onTabChange('admin');
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded-lg transition flex items-center gap-2"
                    >
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      <span>Admin Management</span>
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
        </div>
      </div>
    </header>
  );
};
