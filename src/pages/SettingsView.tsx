import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  Shield,
  HardDrive,
  Copy,
  Check,
  Download,
  ExternalLink,
  Settings,
  Server,
  Layers,
  Key,
  RefreshCw,
  Cpu,
  Lock,
  Terminal,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';

export const SettingsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [r2Status, setR2Status] = useState<any>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [migrationSql, setMigrationSql] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'r2' | 'supabase' | 'limits' | 'appearance'>('r2');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadIntegrationStatus = async () => {
    setIsRefreshing(true);
    try {
      const [r2, supa, sql] = await Promise.all([
        api.getR2Status().catch(err => ({ error: err.message })),
        api.getSupabaseStatus().catch(err => ({ error: err.message })),
        api.getSupabaseMigration().catch(() => '-- Migration file could not be read')
      ]);
      setR2Status(r2);
      setSupabaseStatus(supa);
      setMigrationSql(sql);
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(migrationSql);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([migrationSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '20261016000000_vaultshare_phase1.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1b1e2c] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300">
              ARCHITECTURE & INFRASTRUCTURE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">
            System Settings & Cloud Integrations
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Production Cloudflare R2 object storage, Supabase PostgreSQL RLS schema, and storage quotas.
          </p>
        </div>

        <button
          onClick={loadIntegrationStatus}
          disabled={isRefreshing}
          className="px-3.5 py-2 bg-[#161824] hover:bg-[#1e2232] border border-[#272b3c] rounded-xl text-xs font-semibold text-gray-200 flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : 'text-gray-400'}`} />
          <span>Check Health</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#1b1e2c] pb-2">
        <button
          onClick={() => setActiveTab('r2')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'r2'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-gray-400 hover:text-white hover:bg-[#141620]'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Cloudflare R2 Object Storage</span>
          {r2Status?.isConfigured && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'supabase'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-gray-400 hover:text-white hover:bg-[#141620]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Supabase PostgreSQL & RLS</span>
        </button>

        <button
          onClick={() => setActiveTab('limits')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'limits'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-gray-400 hover:text-white hover:bg-[#141620]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Quota & Upload Limits</span>
        </button>
      </div>

      {/* R2 Object Storage Tab */}
      {activeTab === 'r2' && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className={`p-5 rounded-3xl border ${
            r2Status?.isConfigured
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : 'bg-[#12131e] border-[#222638]'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  r2Status?.isConfigured
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                }`}>
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {r2Status?.storageEngine || 'Cloudflare R2 Object Storage'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r2Status?.isConfigured
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                        : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                    }`}>
                      {r2Status?.isConfigured ? 'Live Connected' : 'Resilient Local S3 Engine Active'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {r2Status?.isConfigured
                      ? 'Browser uploads stream directly to Cloudflare R2 via presigned short-lived URLs.'
                      : 'To route uploads directly to your Cloudflare private bucket, add R2 keys to your environment secrets.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of specs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#11121a] border border-[#202334] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
                Max Single File Size
              </span>
              <p className="text-xl font-black text-white">10 GB</p>
              <p className="text-[11px] text-gray-400 mt-1">Enforced by backend authorization</p>
            </div>

            <div className="p-4 bg-[#11121a] border border-[#202334] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
                Default User Storage Quota
              </span>
              <p className="text-xl font-black text-white">5 GB</p>
              <p className="text-[11px] text-gray-400 mt-1">500 GB for Administrator accounts</p>
            </div>

            <div className="p-4 bg-[#11121a] border border-[#202334] rounded-2xl">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
                Max Concurrent Uploads
              </span>
              <p className="text-xl font-black text-white">3 Transfers</p>
              <p className="text-[11px] text-gray-400 mt-1">Multipart chunks with auto-resume</p>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="p-6 bg-[#11121a] border border-[#222538] rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <span>Cloudflare R2 Connection Instructions</span>
            </h3>
            <ol className="space-y-3 text-xs text-gray-300 list-decimal list-inside">
              <li>Open your <strong className="text-white">Cloudflare Dashboard</strong> and go to <strong className="text-white">R2 Storage</strong>.</li>
              <li>Create a private bucket named <code className="px-1.5 py-0.5 bg-[#1b1e2c] rounded text-purple-300 font-mono">vaultshare-production</code>.</li>
              <li>Under "Manage R2 API Tokens", create an API token with <strong className="text-white">Object Read & Write</strong> permissions.</li>
              <li>Add the following 4 environment variables to your deployment secrets:</li>
            </ol>

            <div className="p-4 bg-[#090a10] border border-[#1b1e2c] rounded-2xl font-mono text-xs text-purple-300 space-y-1">
              <div>R2_ACCOUNT_ID="your_cloudflare_account_id"</div>
              <div>R2_ACCESS_KEY_ID="your_r2_access_key_id"</div>
              <div>R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"</div>
              <div>R2_BUCKET_NAME="vaultshare-production"</div>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Tab */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-[#12131e] border border-[#222638] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {supabaseStatus?.databaseEngine || 'Supabase PostgreSQL'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800">
                    Phase 1 Production Schema Ready
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  12 tables, Row Level Security (RLS) policies, and rating/storage recalculation triggers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySql}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied SQL!' : 'Copy SQL Migration'}</span>
              </button>

              <button
                onClick={handleDownloadSql}
                className="px-3.5 py-2 bg-[#1b1e2c] hover:bg-[#252a3d] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-[#2d3248]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .sql</span>
              </button>
            </div>
          </div>

          {/* 12 Tables Checklist */}
          <div className="p-6 bg-[#11121a] border border-[#222538] rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>12 Tables & Security Policies Defined in Migration</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                'profiles',
                'files',
                'upload_sessions',
                'file_ratings',
                'download_history',
                'favorites',
                'collections',
                'collection_items',
                'file_reports',
                'notifications',
                'storage_usage',
                'admin_audit_logs'
              ].map(table => (
                <div key={table} className="p-3 bg-[#161824] border border-[#232637] rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-xs text-gray-200">{table}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Migration SQL viewer */}
          <div className="p-6 bg-[#11121a] border border-[#222538] rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-gray-300">
                  supabase/migrations/20261016000000_vaultshare_phase1.sql
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                {migrationSql.length} bytes
              </span>
            </div>

            <pre className="p-4 bg-[#0a0b11] border border-[#1d2030] rounded-2xl font-mono text-[11px] text-gray-300 overflow-x-auto max-h-96">
              {migrationSql}
            </pre>
          </div>
        </div>
      )}

      {/* Quota Limits Tab */}
      {activeTab === 'limits' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-6 bg-[#11121a] border border-[#222538] rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-400" />
                <span>Upload & Storage Policies</span>
              </h3>
              <div className="space-y-3 text-xs text-gray-300">
                <div className="flex justify-between py-2 border-b border-[#1c1f2e]">
                  <span>Maximum File Size</span>
                  <span className="font-bold text-white">10 GB</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#1c1f2e]">
                  <span>Default User Quota</span>
                  <span className="font-bold text-white">5 GB</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#1c1f2e]">
                  <span>Admin Quota (spikesprimo6625@gmail.com)</span>
                  <span className="font-bold text-purple-300">500 GB</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#1c1f2e]">
                  <span>Multipart Chunk Size</span>
                  <span className="font-bold text-white">10 MB</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#1c1f2e]">
                  <span>Presigned S3/R2 URL Validity</span>
                  <span className="font-bold text-white">15 Minutes (Upload) / 1 Hour (Download)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Rating Scale</span>
                  <span className="font-bold text-amber-400">1 to 10 Stars (Enforced Uniqueness)</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#11121a] border border-[#222538] rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Security & Authorization Protocols</span>
              </h3>
              <div className="space-y-2.5 text-xs text-gray-300">
                <p>• <strong>Row Level Security (RLS)</strong>: Configured across all 12 database tables.</p>
                <p>• <strong>Never Proxy Binaries in Database</strong>: Files stream directly through S3/R2 presigned URLs.</p>
                <p>• <strong>Object Key Obfuscation</strong>: Server-generated random keys prevent guessing or path manipulation.</p>
                <p>• <strong>Tamper-Proof Downloads</strong>: Download history is recorded only after successful authorization.</p>
                <p>• <strong>Concurrent Quota Throttling</strong>: Prevents users from spawning more than 3 simultaneous multipart uploads.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
