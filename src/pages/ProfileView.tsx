import React, { useState } from 'react';
import {
  User as UserIcon,
  Mail,
  Shield,
  HardDrive,
  Calendar,
  Edit3,
  Download,
  Trash2,
  Check,
  AlertTriangle,
  LogOut,
  FolderLock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatBytes, formatDate } from '../utils/formatters';

interface ProfileViewProps {
  onOpenAuth: () => void;
  onNavigateToVault: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenAuth, onNavigateToVault }) => {
  const { user, isAdmin, updateProfile, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-[#11121a] border border-[#232637] rounded-3xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <UserIcon className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Sign In Required</h2>
        <p className="text-xs text-gray-400">
          Sign in to view your profile, manage your files, track your storage quota, and access security settings.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await updateProfile({ username, bio });
      setIsEditing(false);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    window.location.href = '/api/auth/export-data';
  };

  const handleDeleteAccount = async () => {
    if (user.email.toLowerCase() === 'spikesprimo6625@gmail.com') {
      alert('The primary system administrator account cannot be deleted.');
      return;
    }

    if (!confirm('Are you absolutely certain you want to permanently delete your account and all stored files? This cannot be undone.')) {
      return;
    }

    try {
      await api.deleteAccount();
      logout();
    } catch (err: any) {
      alert(err.message || 'Error deleting account');
    }
  };

  const quotaPercent = Math.min(100, Math.round((user.storageUsedBytes / user.storageLimitBytes) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Profile Header Card */}
      <div className="relative rounded-3xl overflow-hidden border border-[#222538] bg-gradient-to-r from-[#11121a] via-[#10111a] to-[#0a0a0f] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <img
            src={user.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`}
            alt={user.username}
            className="w-24 h-24 rounded-2xl border-2 border-purple-500/40 shadow-xl object-cover bg-[#161824]"
          />

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl font-black text-white">{user.username}</h1>
              {isAdmin && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Primary Administrator</span>
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{user.email}</span>
            </p>

            <p className="text-xs text-gray-300 max-w-xl">
              {user.bio || 'Digital creator & media archivist on VaultShare.'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {formatDate(user.createdAt)}</span>
              </span>
              <span>•</span>
              <span className="font-mono text-purple-400">UID: {user.id.slice(0, 12)}...</span>
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3.5 py-2 bg-[#1b1e2c] hover:bg-[#252a3d] border border-[#2d3248] rounded-xl text-xs font-semibold text-gray-200 flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
            <button
              onClick={logout}
              className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-[#1d2030] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#161824] border border-[#272b3c] focus:border-purple-500 rounded-xl text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#161824] border border-[#272b3c] focus:border-purple-500 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </form>
        )}

        {message && (
          <p className={`mt-4 p-2.5 rounded-xl text-xs ${
            message.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800' : 'bg-rose-950/40 text-rose-400 border border-rose-800'
          }`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Storage Quota Card */}
      <div className="p-6 bg-[#11121a] border border-[#222538] rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Storage Quota & Utilization</h3>
          </div>
          <span className="text-xs font-mono font-bold text-purple-300">
            {formatBytes(user.storageUsedBytes)} of {formatBytes(user.storageLimitBytes)} ({quotaPercent}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#181a26] h-3 rounded-full overflow-hidden border border-[#232738]">
          <div
            className={`h-full transition-all duration-500 ${
              quotaPercent > 90
                ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                : 'bg-gradient-to-r from-purple-600 to-indigo-500'
            }`}
            style={{ width: `${Math.max(2, quotaPercent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>{formatBytes(Math.max(0, user.storageLimitBytes - user.storageUsedBytes))} remaining</span>
          <button
            onClick={onNavigateToVault}
            className="text-purple-400 hover:text-purple-300 transition flex items-center gap-1 font-semibold"
          >
            <FolderLock className="w-3.5 h-3.5" />
            <span>Manage Files in Library</span>
          </button>
        </div>
      </div>

      {/* Account Data & Safety */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-[#11121a] border border-[#222538] rounded-2xl space-y-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Account Data</span>
          </h4>
          <p className="text-[11px] text-gray-400">
            Download a structured JSON archive containing your file records, download history, and personal collections.
          </p>
          <button
            onClick={handleExportData}
            className="mt-2 px-3 py-1.5 bg-[#171924] hover:bg-[#202334] border border-[#282c3e] rounded-xl text-xs font-semibold text-gray-200 transition"
          >
            Download Data Archive
          </button>
        </div>

        <div className="p-5 bg-[#11121a] border border-[#222538] rounded-2xl space-y-2">
          <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Delete Account</span>
          </h4>
          <p className="text-[11px] text-gray-400">
            Permanently remove your profile and delete all uploaded media files from Cloudflare R2 / storage.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="mt-2 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 rounded-xl text-xs font-semibold text-rose-300 transition"
          >
            Permanently Delete
          </button>
        </div>
      </div>
    </div>
  );
};
