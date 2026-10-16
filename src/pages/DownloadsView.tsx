import React, { useState, useEffect } from 'react';
import {
  Download,
  Trash2,
  Search,
  WifiOff,
  CheckCircle,
  HardDrive,
  RefreshCw,
  FolderOpen,
  ArrowDownToLine,
  FileText
} from 'lucide-react';
import { DownloadItem, FileItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDate } from '../utils/formatters';
import { getAllOfflineFiles, deleteOfflineFile, OfflineFileRecord } from '../services/offlineStorage';

interface DownloadsViewProps {
  onSelectFileById: (fileId: string) => void;
  onOpenAuth: () => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({ onSelectFileById, onOpenAuth }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'history' | 'offline'>('history');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [offlineFiles, setOfflineFiles] = useState<OfflineFileRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (user) {
        const res = await api.getUserDownloads();
        setDownloads(res.downloads);
      }
      const offline = await getAllOfflineFiles();
      setOfflineFiles(offline);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleRemoveDownload = async (id: string) => {
    try {
      await api.removeDownloadRecord(id);
      setDownloads(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllDownloads = async () => {
    if (!confirm('Are you sure you want to clear your entire download history?')) return;
    try {
      await api.clearUserDownloads();
      setDownloads([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOffline = async (fileId: string) => {
    try {
      await deleteOfflineFile(fileId);
      setOfflineFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRedownload = (fileId: string, filename: string) => {
    const url = api.getDownloadUrl(fileId);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDownloads = downloads.filter(d =>
    d.fileTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.fileCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOffline = offlineFiles.filter(f =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOfflineSize = offlineFiles.reduce((acc, f) => acc + f.size, 0);

  if (!user && activeTab === 'history') {
    return (
      <div className="py-24 text-center border border-dashed border-[#232738] rounded-3xl bg-[#0f1017] p-8 max-w-xl mx-auto my-12">
        <Download className="w-12 h-12 text-purple-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white mb-1">Sign In to View Download History</h3>
        <p className="text-xs text-gray-400 mb-6">
          GhostShare automatically syncs and tracks your downloaded high-resolution files across devices.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-[#12141e] border border-[#232738] rounded-3xl">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-400" />
            <span>Downloads & Offline Storage</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Access persistent database records of downloads and files cached locally on this device.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 bg-[#171926] p-1 rounded-2xl border border-[#272b3c]">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            History ({downloads.length})
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'offline'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>On-Device Offline ({offlineFiles.length})</span>
          </button>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in downloads..."
            className="w-full pl-10 pr-4 py-2 bg-[#141620] border border-[#222636] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition"
          />
        </div>

        {activeTab === 'history' && downloads.length > 0 && (
          <button
            onClick={handleClearAllDownloads}
            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}

        {activeTab === 'offline' && (
          <div className="text-xs text-emerald-400 font-mono flex items-center gap-2 bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-800/40">
            <HardDrive className="w-4 h-4" />
            <span>Device Storage Used: {formatBytes(totalOfflineSize)}</span>
          </div>
        )}
      </div>

      {/* Tab 1: Persistent Download History */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {filteredDownloads.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#232738] rounded-2xl bg-[#0f1017]">
              <Download className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No downloaded files in your history yet.</p>
            </div>
          ) : (
            filteredDownloads.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-[#12131a] border border-[#212433] hover:border-purple-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition"
              >
                <div
                  onClick={() => onSelectFileById(item.fileId)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white hover:text-purple-300 transition truncate">
                      {item.fileTitle}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                      <span className="capitalize">{item.fileCategory}</span>
                      <span>•</span>
                      <span>{formatBytes(item.fileSizeBytes)}</span>
                      <span>•</span>
                      <span>Downloaded {formatDate(item.downloadedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleRedownload(item.fileId, item.fileTitle)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Download Again</span>
                  </button>
                  <button
                    onClick={() => handleRemoveDownload(item.id)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-[#1a1d2c] transition"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Offline Stored Files (IndexedDB) */}
      {activeTab === 'offline' && (
        <div className="space-y-3">
          {filteredOffline.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#232738] rounded-2xl bg-[#0f1017]">
              <WifiOff className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 mb-1">No files saved for offline access yet.</p>
              <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                Open any file details and click "Save for Offline" to store it directly in browser IndexedDB memory.
              </p>
            </div>
          ) : (
            filteredOffline.map((f) => (
              <div
                key={f.id}
                className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div
                  onClick={() => onSelectFileById(f.id)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white hover:text-purple-300 transition truncate">
                      {f.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                      <span className="capitalize">{f.category}</span>
                      <span>•</span>
                      <span>{formatBytes(f.size)}</span>
                      <span>•</span>
                      <span>Cached {formatDate(f.savedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => onSelectFileById(f.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shadow"
                  >
                    Open Offline
                  </button>
                  <button
                    onClick={() => handleDeleteOffline(f.id)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-[#1a1d2c] transition"
                    title="Delete local copy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
