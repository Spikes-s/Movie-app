/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { Navbar } from './components/Navbar';
import { HomeDiscovery } from './pages/HomeDiscovery';
import { LinkConverterView } from './pages/LinkConverterView';
import { DownloadsView } from './pages/DownloadsView';
import { LibraryView } from './pages/LibraryView';
import { AdminDashboard } from './pages/AdminDashboard';
import { UploadModal } from './components/UploadModal';
import { FileDetailModal } from './components/FileDetailModal';
import { ShareModal } from './components/ShareModal';
import { ReportModal } from './components/ReportModal';
import { AuthModal } from './components/AuthModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { FileItem } from './types';
import { api } from './services/api';

function GhostShareApp() {
  const { user, isAdmin } = useAuth();

  const [currentTab, setCurrentTab] = useState<'discovery' | 'converter' | 'downloads' | 'library' | 'admin'>('discovery');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const [reportingFile, setReportingFile] = useState<FileItem | null>(null);

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

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#f1f3f9] flex flex-col font-sans selection:bg-purple-600 selection:text-white">
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
        onOpenUpload={() => setIsUploadOpen(true)}
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
          />
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

      {/* File Details & 4K/8K Video/Audio Player Modal */}
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
      <ShareModal
        file={sharingFile}
        isOpen={Boolean(sharingFile)}
        onClose={() => setSharingFile(null)}
      />

      {/* Report Modal */}
      <ReportModal
        file={reportingFile}
        isOpen={Boolean(reportingFile)}
        onClose={() => setReportingFile(null)}
        onRequireLogin={() => setIsAuthOpen(true)}
      />

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
        <GhostShareApp />
      </AudioProvider>
    </AuthProvider>
  );
}
