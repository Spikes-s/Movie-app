import React, { useState } from 'react';
import { X, Flag, AlertTriangle } from 'lucide-react';
import { FileItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ReportModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ file, isOpen, onClose, onRequireLogin }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('copyright');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireLogin();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.submitReport({
        targetType: 'file',
        targetId: file.id,
        targetTitle: file.title,
        reason,
        notes
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setNotes('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#12141d] border border-[#232738] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1f2230] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Report Content</h3>
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

        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Report Received</h4>
            <p className="text-xs text-gray-400 mt-1">Our moderation team will review this item promptly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Reason for report *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-rose-500 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="copyright">Copyright Infringement (DMCA)</option>
                <option value="malware">Malware, Virus, or Phishing</option>
                <option value="spam">Spam or Misleading Metadata</option>
                <option value="inappropriate">Inappropriate, Explicit, or Harmful Content</option>
                <option value="other">Other Violation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Detailed notes & timestamps
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe why this file violates GhostShare acceptable use policies..."
                className="w-full px-3 py-2 bg-[#171924] border border-[#272b3b] focus:border-rose-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400">{errorMsg}</p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1f2230]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#1b1e2c] text-gray-300 hover:text-white rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
