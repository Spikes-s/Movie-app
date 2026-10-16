/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { Navbar, NavigationTab } from './components/Navbar';
import { HomeDiscovery } from './pages/HomeDiscovery';
import { LinkConverterView } from './pages/LinkConverterView';
import { DownloadsView } from './pages/DownloadsView';
import { LibraryView } from './pages/LibraryView';
import { ProfileView } from './pages/ProfileView';
import { SettingsView } from './pages/SettingsView';
import { AdminDashboard } from './pages/AdminDashboard';
import { UploadModal } from './components/UploadModal';
import { FileDetailModal } from './components/FileDetailModal';
import { ShareModal } from './components/ShareModal';
import { ReportModal } from './components/ReportModal';
import { AuthModal } from './components/AuthModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { FileItem } from './types';
import { api } from './services/api';
import {
  AlertOctagon,
  RefreshCw,
  Power,
  ShieldAlert,
  LogIn,
  CheckCircle2,
  Clock
} from 'lucide-react';

function VaultShareApp() {
  const { user, isAdmin } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavigationTab>('discovery');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const [reportingFile, setReportingFile] = useState<FileItem | null>(null);

  // System status and emergency shutdown state
  const [systemStatus, setSystemStatus] = useState<{
    maintenanceMode: boolean;
    appName?: string;
    shutdownReason?: string;
    shutdownAt?: string;
  } | null>(null);
  const [isRestoringQuick, setIsRestoringQuick] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const checkStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await api.getSystemStatus();
      setSystemStatus(res);
    } catch (e) {
      console.warn('Status check warning:', e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickRestore = async () => {
    setIsRestoringQuick(true);
    try {
      await api.restoreWebsite();
      await checkStatus();
    } catch (err: any) {
      alert(err.message || 'Failed to restore website.');
    } finally {
      setIsRestoringQuick(false);
    }
  };

  // Check URL parameters on mount (?file=xyz or ?share=xyz)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileParam = params.get('file');
    const shareParam = params.get('share');

    if (fileParam) {
      setSelectedFileId(fileParam);
      setIsDetailOpen(true);
    } else if (shareParam) {
      api.getFileByShareToken(shareParam)
        .then(res => {
          setSelectedFileId(res.file.id);
          setIsDetailOpen(true);
        })
        .catch(err => console.warn('Could not resolve share token:', err));
    }
  }, []);

  const handleSelectFile = (file: FileItem) => {
    setSelectedFileId(file.id);
    setIsDetailOpen(true);
  };

  const handleSelectFileById = (fileId: string) => {
    setSelectedFileId(fileId);
    setIsDetailOpen(true);
  };

  const handleShareFile = (file: FileItem) => {
    setSharingFile(file);
  };

  const handleReportFile = (file: FileItem) => {
    setReportingFile(file);
  };

  const handleUploadSuccess = (newFile: FileItem) => {
    setSelectedFileId(newFile.id);
    setIsDetailOpen(true);
  };

  // If system is shutdown / in maintenance mode and user is not an admin, render the full-screen lockdown screen
  if (systemStatus?.maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#07080c] text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden font-sans">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-950/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-950/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-lg w-full bg-[#0e1017]/95 border border-rose-900/40 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-rose-950/50 text-center backdrop-blur-xl">
          {/* Beacon / Icon */}
          <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-rose-600/20 animate-ping opacity-60" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-900 to-rose-600 flex items-center justify-center border-2 border-rose-400/50 shadow-xl shadow-rose-900/60">
              <ShieldAlert className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-700/50 text-rose-300 text-xs font-mono font-semibold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            Platform Lockdown Active
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
            VaultShare System Offline
          </h1>

          <p className="text-sm text-gray-300 leading-relaxed mb-6">
            {systemStatus.shutdownReason || 'Emergency platform maintenance and security audit in progress. Public uploads and downloads have been safely quarantined.'}
          </p>

          {/* Details Card */}
          <div className="bg-[#141622] border border-[#222638] rounded-2xl p-4 text-left text-xs space-y-2 mb-8">
            <div className="flex items-center justify-between text-gray-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" /> Offline Initiated:
              </span>
              <span className="font-mono text-gray-200">
                {systemStatus.shutdownAt ? new Date(systemStatus.shutdownAt).toLocaleTimeString() : 'Recent'}
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>Security State:</span>
              <span className="text-emerald-400 font-medium">Safe & Isolated</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>Restoration:</span>
              <span className="text-rose-400 font-medium">Pending Admin Unlock</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={checkStatus}
              disabled={isCheckingStatus}
              className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-[#1a1d2d] hover:bg-[#23273c] text-white text-xs font-bold transition flex items-center justify-center gap-2 border border-[#2a2f47] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin text-purple-400' : 'text-gray-400'}`} />
              <span>{isCheckingStatus ? 'Checking...' : 'Check Status'}</span>
            </button>

            <button
              onClick={() => setIsAuthOpen(true)}
              className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 border border-purple-400/30"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Admin Access</span>
            </button>
          </div>
        </div>

        {/* Auth Modal for Admin Unlock */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#f1f3f9] flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Admin Emergency Shutdown Active Banner */}
      {systemStatus?.maintenanceMode && isAdmin && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border-b border-rose-500/60 px-4 py-2.5 text-xs text-rose-100 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <AlertOctagon className="w-4 h-4 text-rose-300 shrink-0" />
            <span>
              <strong>SYSTEM SHUTDOWN ACTIVE:</strong> The website is currently offline to all public visitors ({systemStatus.shutdownReason || 'Emergency maintenance'}).
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleQuickRestore}
              disabled={isRestoringQuick}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/60 border border-emerald-400/40 active:scale-95 disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isRestoringQuick ? 'Restoring Website...' : 'Restore Website Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'admin' && !isAdmin) {
            setIsAuthOpen(true);
            return;
          }
          setCurrentTab(tab);
        }}
        onOpenUpload={() => (user ? setIsUploadOpen(true) : setIsAuthOpen(true))}
        onOpenAuth={() => setIsAuthOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {currentTab === 'discovery' && (
          <HomeDiscovery
            searchQuery={searchQuery}
            onSelectFile={handleSelectFile}
            onShareFile={handleShareFile}
            onOpenUpload={() => (user ? setIsUploadOpen(true) : setIsAuthOpen(true))}
            initialCategory="all"
          />
        )}

        {currentTab === 'videos' && (
          <HomeDiscovery
            searchQuery={searchQuery}
            onSelectFile={handleSelectFile}
            onShareFile={handleShareFile}
            onOpenUpload={() => (user ? setIsUploadOpen(true) : setIsAuthOpen(true))}
            initialCategory="video"
          />
        )}

        {currentTab === 'music' && (
          <HomeDiscovery
            searchQuery={searchQuery}
            onSelectFile={handleSelectFile}
            onShareFile={handleShareFile}
            onOpenUpload={() => (user ? setIsUploadOpen(true) : setIsAuthOpen(true))}
            initialCategory="audio"
          />
        )}

        {currentTab === 'documents' && (
          <HomeDiscovery
            searchQuery={searchQuery}
            onSelectFile={handleSelectFile}
            onShareFile={handleShareFile}
            onOpenUpload={() => (user ? setIsUploadOpen(true) : setIsAuthOpen(true))}
            initialCategory="document"
          />
        )}

        {currentTab === 'browse' && (
          <HomeDiscovery
            searchQuery={searchQuery}
            onSelectFile={handleSelectFile}
            onShareFile={handleShareFile}
            onOpenUpload={() => (user ? setIsUploadOpen(true) : setIsAuthOpen(true))}
            initialCategory="all"
            hideHero={true}
          />
        )}

        {currentTab === 'converter' && (
          <LinkConverterView
            onOpenAuth={() => setIsAuthOpen(true)}
            onNavigateToVault={() => setCurrentTab('library')}
          />
        )}

        {currentTab === 'downloads' && (
          <DownloadsView
            onSelectFileById={handleSelectFileById}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {currentTab === 'library' && (
          <LibraryView
            onSelectFile={handleSelectFile}
            onOpenUpload={() => setIsUploadOpen(true)}
            onShareFile={handleShareFile}
            initialTab="uploads"
          />
        )}

        {currentTab === 'favorites' && (
          <LibraryView
            onSelectFile={handleSelectFile}
            onOpenUpload={() => setIsUploadOpen(true)}
            onShareFile={handleShareFile}
            initialTab="favorites"
          />
        )}

        {currentTab === 'collections' && (
          <LibraryView
            onSelectFile={handleSelectFile}
            onOpenUpload={() => setIsUploadOpen(true)}
            onShareFile={handleShareFile}
            initialTab="collections"
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            onOpenAuth={() => setIsAuthOpen(true)}
            onNavigateToVault={() => setCurrentTab('library')}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView />
        )}

        {currentTab === 'admin' && isAdmin && (
          <AdminDashboard />
        )}
      </main>

      {/* Persistent Bottom Audio Player Bar */}
      <AudioPlayerBar />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* File Detail Modal */}
      {selectedFileId && (
        <FileDetailModal
          fileId={selectedFileId}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedFileId(null);
          }}
          onShare={handleShareFile}
          onReport={handleReportFile}
          onRequireLogin={() => setIsAuthOpen(true)}
        />
      )}

      {/* Share Modal */}
      {sharingFile && (
        <ShareModal
          file={sharingFile}
          isOpen={Boolean(sharingFile)}
          onClose={() => setSharingFile(null)}
        />
      )}

      {/* Moderation / Report Modal */}
      {reportingFile && (
        <ReportModal
          file={reportingFile}
          isOpen={Boolean(reportingFile)}
          onClose={() => setReportingFile(null)}
          onRequireLogin={() => setIsAuthOpen(true)}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <VaultShareApp />
      </AudioProvider>
    </AuthProvider>
  );
}
