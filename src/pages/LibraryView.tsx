import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Upload,
  Heart,
  Layers,
  HardDrive,
  Trash2,
  Edit3,
  Plus,
  Eye,
  Lock,
  Globe,
  Link2,
  Check,
  AlertCircle
} from 'lucide-react';
import { FileItem, CollectionItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';
import { FileCard } from '../components/FileCard';

interface LibraryViewProps {
  onSelectFile: (file: FileItem) => void;
  onOpenUpload: () => void;
  onShareFile: (file: FileItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onSelectFile,
  onOpenUpload,
  onShareFile
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'uploads' | 'favorites' | 'collections'>('uploads');
  const [myUploads, setMyUploads] = useState<FileItem[]>([]);
  const [favoriteFiles, setFavoriteFiles] = useState<FileItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(25 * 1024 * 1024 * 1024);
  const [isLoading, setIsLoading] = useState(true);

  // New collection modal state
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');

  // Edit file metadata state
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'unlisted' | 'private'>('public');

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUserLibrary();
      setMyUploads(res.myUploads);
      setFavoriteFiles(res.favoriteFiles);
      setCollections(res.collections);
      setStorageUsed(res.storageUsedBytes);
      setStorageLimit(res.storageLimitBytes);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, [user]);

  const handleDeleteUpload = async (fileId: string) => {
    if (!confirm('Are you sure you want to permanently delete this file? This action is irreversible.')) return;
    try {
      await api.deleteFile(fileId);
      setMyUploads(prev => prev.filter(f => f.id !== fileId));
      loadLibrary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartEdit = (file: FileItem) => {
    setEditingFile(file);
    setEditTitle(file.title);
    setEditDesc(file.description || '');
    setEditVisibility(file.visibility);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;

    try {
      const res = await api.updateFile(editingFile.id, {
        title: editTitle,
        description: editDesc,
        visibility: editVisibility
      });
      setMyUploads(prev => prev.map(f => f.id === res.file.id ? res.file : f));
      setEditingFile(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    try {
      const res = await api.createCollection({
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim(),
        isPublic: false
      });
      setCollections(prev => [...prev, res.collection]);
      setNewCollectionName('');
      setNewCollectionDesc('');
      setIsCreatingCollection(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Delete this collection?')) return;
    try {
      await api.deleteCollection(id);
      setCollections(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const usedPercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Storage Quota Card */}
      <div className="p-6 bg-[#12141e] border border-[#232738] rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex-1 max-w-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Encrypted Cloud Storage</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {formatBytes(storageUsed)} of {formatBytes(storageLimit)} used ({usedPercent}%)
          </p>

          <div className="w-full bg-[#1b1e2c] h-2.5 rounded-full overflow-hidden border border-[#262c3e]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usedPercent > 85 ? 'bg-rose-500' : 'bg-gradient-to-r from-purple-600 to-indigo-500'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUpload}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1f2230] pb-3">
        <button
          onClick={() => setActiveTab('uploads')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'uploads'
              ? 'bg-purple-600 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#141622]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>My Uploads ({myUploads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'favorites'
              ? 'bg-purple-600 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#141622]'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Favorites ({favoriteFiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('collections')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'collections'
              ? 'bg-purple-600 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#141622]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Collections ({collections.length})</span>
        </button>
      </div>

      {/* Tab 1: My Uploads */}
      {activeTab === 'uploads' && (
        <div>
          {myUploads.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#232738] rounded-2xl bg-[#0f1017]">
              <Upload className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 mb-3">You haven't uploaded any media yet.</p>
              <button
                onClick={onOpenUpload}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl"
              >
                Upload First File
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myUploads.map((file) => (
                <div
                  key={file.id}
                  className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div
                    onClick={() => onSelectFile(file)}
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    {file.thumbnailUrl ? (
                      <img
                        src={file.thumbnailUrl}
                        alt={file.title}
                        className="w-14 h-10 rounded-lg object-cover bg-black shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-10 rounded-lg bg-[#181a26] flex items-center justify-center text-purple-400 font-mono text-[10px] uppercase font-bold shrink-0">
                        {file.category}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white hover:text-purple-300 transition truncate">
                          {file.title}
                        </h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                          file.visibility === 'public'
                            ? 'bg-purple-950 border-purple-800 text-purple-300'
                            : file.visibility === 'unlisted'
                            ? 'bg-indigo-950 border-indigo-800 text-indigo-300'
                            : 'bg-gray-900 border-gray-700 text-gray-400'
                        }`}>
                          {file.visibility}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                        <span>{formatBytes(file.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>{file.downloadsCount} downloads</span>
                        <span>•</span>
                        <span>{file.ratingAverage > 0 ? `${file.ratingAverage}★` : 'unrated'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleStartEdit(file)}
                      className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1d2c] transition"
                      title="Edit metadata"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUpload(file.id)}
                      className="p-2 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-[#1a1d2c] transition"
                      title="Delete upload"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Favorites */}
      {activeTab === 'favorites' && (
        <div>
          {favoriteFiles.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#232738] rounded-2xl bg-[#0f1017]">
              <Heart className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No favorited media yet. Star files to save them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {favoriteFiles.map((file) => (
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
      )}

      {/* Tab 3: Collections */}
      {activeTab === 'collections' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreatingCollection(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Collection</span>
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#232738] rounded-2xl bg-[#0f1017]">
              <Layers className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Organize your files into playlists and custom media vaults.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {collections.map((col) => (
                <div
                  key={col.id}
                  className="p-5 bg-[#12131a] border border-[#212433] rounded-2xl flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white">{col.name}</h4>
                      <button
                        onClick={() => handleDeleteCollection(col.id)}
                        className="text-gray-500 hover:text-rose-400 p-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {col.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">{col.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-purple-400 font-mono">
                    {col.fileIds.length} {col.fileIds.length === 1 ? 'file' : 'files'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Collection Modal */}
      {isCreatingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-[#12141e] border border-[#232738] rounded-3xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Create New Collection</h3>
            <form onSubmit={handleCreateCollection} className="space-y-3">
              <input
                type="text"
                required
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection Name..."
                className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <textarea
                rows={2}
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="Description (optional)..."
                className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCollection(false)}
                  className="px-3 py-1.5 bg-[#1b1e2c] text-gray-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit File Metadata Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#12141e] border border-[#232738] rounded-3xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Edit File Metadata</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Visibility</label>
                <select
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="public">Public (Searchable)</option>
                  <option value="unlisted">Unlisted (Secret link only)</option>
                  <option value="private">Private (Only you)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="px-3 py-1.5 bg-[#1b1e2c] text-gray-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
