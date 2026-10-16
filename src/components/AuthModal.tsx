import React, { useState } from 'react';
import { X, Lock, Mail, User, Sparkles, CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAdminPrompt?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, googleLogin } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'recovery'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setRecoveryMessage(null);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        await register(email, username, password);
        onClose();
      } else if (mode === 'recovery') {
        if (recoveryStep === 'request') {
          const res = await api.forgotPassword(email);
          setRecoveryMessage(res.message);
          setRecoveryStep('reset');
        } else {
          const res = await api.resetPassword(email, newPassword);
          setRecoveryMessage(res.message);
          setTimeout(() => {
            setMode('login');
            setRecoveryStep('request');
            setRecoveryMessage(null);
          }, 2000);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Admin Login helper specifically for spikesprimo6625@gmail.com
  const handleQuickAdminLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await login('spikesprimo6625@gmail.com', 'AdminVault2026!');
      onClose();
    } catch (err: any) {
      try {
        await googleLogin('spikesprimo6625@gmail.com', 'PrimoAdmin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
        onClose();
      } catch (e2: any) {
        setErrorMessage(e2.message || 'Admin login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#11121a] border border-[#232738] rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1f2230] mb-6">
          <div>
            <h2 className="text-lg font-black text-white">
              {mode === 'login' && 'Sign In to VaultShare'}
              {mode === 'register' && 'Create a VaultShare Account'}
              {mode === 'recovery' && 'Account Recovery'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === 'recovery'
                ? 'Reset your password to regain access to your vault'
                : 'Access 8K media streaming, high-speed downloads, and collections'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-[#1f2230] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Administrator Shortcut Card */}
        {mode !== 'recovery' && (
          <div className="mb-6 p-3.5 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-purple-300 font-bold uppercase tracking-wider block">
                ADMIN ACCESS
              </span>
              <p className="text-xs font-semibold text-white truncate">
                spikesprimo6625@gmail.com
              </p>
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleQuickAdminLogin}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shrink-0 shadow-md transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Admin Sign In</span>
            </button>
          </div>
        )}

        {/* Tab switch */}
        {mode !== 'recovery' ? (
          <div className="flex bg-[#161824] p-1 rounded-xl mb-5 border border-[#232637]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === 'login'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === 'register'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setRecoveryStep('request');
                setErrorMessage(null);
                setRecoveryMessage(null);
              }}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. AstroStream"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition"
                />
              </div>
            </div>
          )}

          {mode !== 'recovery' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery');
                      setErrorMessage(null);
                      setRecoveryMessage(null);
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 transition"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition"
                />
              </div>
            </div>
          )}

          {mode === 'recovery' && recoveryStep === 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#171924] border border-[#272b3b] focus:border-purple-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition"
                />
              </div>
            </div>
          )}

          {recoveryMessage && (
            <p className="text-xs text-emerald-400 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/40 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{recoveryMessage}</span>
            </p>
          )}

          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-950/30 p-2.5 rounded-xl border border-rose-800/40">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-900/30 transition disabled:opacity-50"
          >
            {isLoading
              ? 'Processing...'
              : mode === 'login'
              ? 'Sign In to Account'
              : mode === 'register'
              ? 'Create Account'
              : recoveryStep === 'request'
              ? 'Send Recovery Instructions'
              : 'Update Password & Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
