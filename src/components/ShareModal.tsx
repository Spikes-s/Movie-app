import React, { useState } from 'react';
import { X, Copy, Check, Globe, Link2, Lock, Share2 } from 'lucide-react';
import { FileItem } from '../types';

interface ShareModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ file, isOpen, onClose }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen || !file) return null;

  const origin = window.location.origin;
  const publicUrl = `${origin}?file=${file.id}`;
  const unlistedUrl = file.shareToken ? `${origin}?share=${file.shareToken}` : publicUrl;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#12141d] border border-[#232738] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1f2230] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Share Media</h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{file.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-[#1f2230] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Public Link */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Direct File Link</span>
              </span>
              <span className="text-[10px] text-gray-500 uppercase font-mono">Public</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 px-3 py-2 bg-[#171924] border border-[#272b3b] rounded-xl text-xs text-gray-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={() => handleCopy(publicUrl, 'public')}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {copiedType === 'public' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'public' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Unlisted Link */}
          {file.shareToken && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Unlisted Secret Link</span>
                </span>
                <span className="text-[10px] text-gray-500 uppercase font-mono">Token Access</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={unlistedUrl}
                  className="flex-1 px-3 py-2 bg-[#171924] border border-[#272b3b] rounded-xl text-xs text-gray-300 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(unlistedUrl, 'unlisted')}
                  className="px-3 py-2 bg-[#1f2232] hover:bg-[#282d42] border border-[#2b3046] text-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedType === 'unlisted' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'unlisted' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Anyone with this private unlisted link can view and download this file without discovering it on the public feed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
