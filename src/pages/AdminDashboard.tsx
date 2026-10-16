import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  HardDrive,
  FileText,
  AlertTriangle,
  Sliders,
  CheckCircle,
  XCircle,
  Trash2,
  Search,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Download,
  Eye,
  Settings
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, FileItem, ReportItem, SystemSettings } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'files' | 'reports' | 'settings'>('overview');

  const [overview, setOverview] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [reportsList, setReportsList] = useState<ReportItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [over, u, f, r, s] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminUsers(),
        api.getFiles({ limit: 100 }),
        api.getAdminReports(),
        api.getAdminSettings()
      ]);

      setOverview(over);
      setUsersList(u.users);
      setFilesList(f.files);
      setReportsList(r.reports);
      setSettings(s.settings);
    } catch (err) {
      console.error('Failed to load admin console data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await api.setAdminUserRole(userId, newRole);
      setUsersList(prev => prev.map(u => u.id === userId ? res.user : u));
      showMessage('User role updated successfully');
    } catch (err: any) {
      showMessage(err.message || 'Error updating role');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentSuspended: boolean) => {
    try {
      const res = await api.setAdminUserStatus(userId, !currentSuspended);
      setUsersList(prev => prev.map(u => u.id === userId ? res.user : u));
      showMessage(currentSuspended ? 'User reinstated' : 'User suspended');
    } catch (err: any) {
      showMessage(err.message || 'Error updating status');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to permanently delete this file from storage?')) return;
    try {
      await api.deleteFile(fileId);
      setFilesList(prev => prev.filter(f => f.id !== fileId));
      showMessage('File deleted permanently from server');
    } catch (err: any) {
      showMessage(err.message || 'Error deleting file');
    }
  };

  const handleUpdateReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      const res = await api.updateAdminReport(reportId, status);
      setReportsList(prev => prev.map(r => r.id === reportId ? res.report : r));
      showMessage(`Report marked as ${status}`);
    } catch (err: any) {
      showMessage(err.message || 'Error resolving report');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await api.updateAdminSettings(settings);
      setSettings(res.settings);
      showMessage('System settings updated');
    } catch (err: any) {
      showMessage(err.message || 'Error saving settings');
    }
  };

  const showMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Admin Top Header Banner */}
      <div className="p-6 bg-gradient-to-r from-[#171226] via-[#131422] to-[#0e1017] border border-rose-900/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">Security & Administration Console</h1>
              <span className="px-2 py-0.5 rounded-md bg-rose-950 border border-rose-700/60 text-[10px] font-mono font-bold text-rose-300">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Active Administrator: <span className="text-purple-300 font-mono">spikesprimo6625@gmail.com</span>
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="px-3 py-1.5 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-semibold animate-fade-in">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#1f2230] pb-3">
        {[
          { id: 'overview', label: 'Metrics & Health', icon: Activity },
          { id: 'users', label: `Users (${usersList.length})`, icon: Users },
          { id: 'files', label: `Files (${filesList.length})`, icon: FileText },
          { id: 'reports', label: `Reports (${reportsList.filter(r => r.status === 'pending').length} pending)`, icon: AlertTriangle },
          { id: 'settings', label: 'System Configuration', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${
                isActive
                  ? 'bg-rose-950 border border-rose-500/40 text-rose-300 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-[#141622]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: OVERVIEW METRICS */}
      {activeSection === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Total Users</span>
              <p className="text-xl font-black text-white mt-1">{overview.metrics.totalUsers}</p>
            </div>
            <div className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Total Files</span>
              <p className="text-xl font-black text-white mt-1">{overview.metrics.totalFiles}</p>
            </div>
            <div className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Storage Consumed</span>
              <p className="text-xl font-black text-white mt-1">{formatBytes(overview.metrics.totalStorageBytes)}</p>
            </div>
            <div className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Global Downloads</span>
              <p className="text-xl font-black text-white mt-1">{overview.metrics.totalDownloads}</p>
            </div>
            <div className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Global Streams</span>
              <p className="text-xl font-black text-white mt-1">{overview.metrics.totalViews}</p>
            </div>
            <div className="p-4 bg-[#12131a] border border-rose-900/30 rounded-2xl">
              <span className="text-[10px] font-mono text-rose-400 uppercase">Pending Reports</span>
              <p className="text-xl font-black text-rose-400 mt-1">{overview.metrics.pendingReportsCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Downloaded Files */}
            <div className="p-5 bg-[#12131a] border border-[#212433] rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span>Top High-Traffic Assets</span>
              </h3>
              <div className="space-y-3">
                {overview.topDownloaded?.map((f: FileItem) => (
                  <div key={f.id} className="flex items-center justify-between text-xs p-2 bg-[#171926] rounded-xl">
                    <span className="truncate max-w-[200px] text-white font-medium">{f.title}</span>
                    <span className="font-mono text-purple-400 font-bold">{f.downloadsCount} dl</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Distribution */}
            <div className="p-5 bg-[#12131a] border border-[#212433] rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                Storage Allocation by Media Category
              </h3>
              <div className="space-y-2">
                {Object.entries(overview.categoryBreakdown || {}).map(([cat, count]: any) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-gray-300">{cat}</span>
                    <span className="font-mono text-gray-400 font-semibold">{count} items</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: USERS MANAGEMENT */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search users by email or username..."
              className="w-full pl-10 pr-3.5 py-2 bg-[#141620] border border-[#222636] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
            />
          </div>

          <div className="bg-[#12131a] border border-[#212433] rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161824] border-b border-[#212433] text-gray-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Storage Used</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2230]">
                  {usersList
                    .filter(u => u.email.toLowerCase().includes(searchFilter.toLowerCase()) || u.username.toLowerCase().includes(searchFilter.toLowerCase()))
                    .map((usr) => {
                      const isPrimaryAdmin = usr.email.toLowerCase() === 'spikesprimo6625@gmail.com';
                      return (
                        <tr key={usr.id} className="hover:bg-[#161826] transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {usr.avatarUrl ? (
                                <img src={usr.avatarUrl} alt={usr.username} className="w-7 h-7 rounded-lg object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-purple-900/60 text-purple-200 font-bold flex items-center justify-center text-[10px]">
                                  {usr.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-white">{usr.username}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{usr.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              disabled={isPrimaryAdmin}
                              value={usr.role}
                              onChange={(e) => handleUpdateUserRole(usr.id, e.target.value)}
                              className="px-2 py-1 bg-[#1a1d2c] border border-[#282d42] rounded-lg text-xs font-mono uppercase text-purple-300 focus:outline-none"
                            >
                              <option value="user">User</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-300">
                            {formatBytes(usr.storageUsedBytes || 0)}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {formatDate(usr.createdAt)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              usr.isSuspended
                                ? 'bg-rose-950 border border-rose-800 text-rose-300'
                                : 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                            }`}>
                              {usr.isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isPrimaryAdmin && (
                              <button
                                onClick={() => handleToggleUserStatus(usr.id, Boolean(usr.isSuspended))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                  usr.isSuspended
                                    ? 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900'
                                    : 'bg-rose-950/60 text-rose-300 hover:bg-rose-900'
                                }`}
                              >
                                {usr.isSuspended ? 'Reinstate' : 'Suspend'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: FILE MANAGEMENT */}
      {activeSection === 'files' && (
        <div className="space-y-4">
          <div className="bg-[#12131a] border border-[#212433] rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161824] border-b border-[#212433] text-gray-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Title & Details</th>
                    <th className="py-3 px-4">Uploader</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Visibility</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2230]">
                  {filesList.map((f) => (
                    <tr key={f.id} className="hover:bg-[#161826] transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white max-w-xs truncate">{f.title}</p>
                          {f.metadata?.resolution && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                              {f.metadata.resolution}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono">{f.originalFilename}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{f.uploaderName}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{formatBytes(f.fileSizeBytes)}</td>
                      <td className="py-3 px-4 font-mono text-amber-400 font-bold">{f.ratingAverage}★ ({f.ratingCount})</td>
                      <td className="py-3 px-4 font-mono text-gray-400 capitalize">{f.visibility}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteFile(f.id)}
                          className="p-1.5 text-gray-500 hover:text-rose-400 transition"
                          title="Delete content"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: REPORTS & MODERATION */}
      {activeSection === 'reports' && (
        <div className="space-y-4">
          {reportsList.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#232738] rounded-2xl bg-[#0f1017]">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Zero active reports. All systems clear.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportsList.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 bg-[#12131a] border border-[#212433] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-rose-950 border border-rose-800 text-rose-300">
                        {rep.reason}
                      </span>
                      <h4 className="text-xs font-bold text-white">{rep.targetTitle || rep.targetId}</h4>
                    </div>
                    {rep.notes && (
                      <p className="text-xs text-gray-400 mt-1">{rep.notes}</p>
                    )}
                    <p className="text-[10px] text-gray-500 font-mono mt-1">
                      Reported by {rep.reporterName} on {formatDate(rep.createdAt)} • Status: {rep.status}
                    </p>
                  </div>

                  {rep.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateReport(rep.id, 'resolved')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
                      >
                        Resolve & Takedown
                      </button>
                      <button
                        onClick={() => handleUpdateReport(rep.id, 'dismissed')}
                        className="px-3 py-1.5 bg-[#1b1e2c] text-gray-300 hover:text-white rounded-xl text-xs font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: SYSTEM SETTINGS */}
      {activeSection === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl bg-[#12131a] border border-[#212433] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white mb-2">Platform Storage & Quota Settings</h3>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Maximum Single File Upload Size (Bytes)
            </label>
            <input
              type="number"
              value={settings.maxUploadSizeBytes}
              onChange={(e) => setSettings({ ...settings, maxUploadSizeBytes: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white font-mono"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              Currently: {formatBytes(settings.maxUploadSizeBytes)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Default User Account Storage Quota (Bytes)
            </label>
            <input
              type="number"
              value={settings.defaultUserStorageQuotaBytes}
              onChange={(e) => setSettings({ ...settings, defaultUserStorageQuotaBytes: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white font-mono"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              Currently: {formatBytes(settings.defaultUserStorageQuotaBytes)}
            </span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg"
            >
              Save System Configuration
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
