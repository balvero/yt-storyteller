import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { hashPassword } from '../utils/crypto';

export const LockScreen: React.FC<{
  expectedPassword?: string;
  expectedHash?: string;
  onUnlock: () => void;
}> = ({ expectedPassword, expectedHash, onUnlock }) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputHash = await hashPassword(passwordInput);

    const matchHash = expectedHash && inputHash.toLowerCase() === expectedHash.toLowerCase();
    const matchPlaintext = expectedPassword && (passwordInput === expectedPassword || inputHash.toLowerCase() === expectedPassword.toLowerCase());

    if (matchHash || matchPlaintext) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500 shadow-lg shadow-amber-500/10">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-100">YouTube Shorts Storyteller</h2>
          <p className="text-xs text-slate-400 mt-1">This application is protected. Enter your passcode to unlock.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setError(false);
                }}
                placeholder="Enter App Password..."
                autoFocus
                className={`w-full px-4 py-3.5 pl-11 bg-slate-950 border ${
                  error ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-amber-500'
                } rounded-xl text-sm text-slate-100 focus:outline-none transition-all`}
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            {error && (
              <p className="text-xs font-bold text-red-400 mt-2">Incorrect password. Please try again.</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
          >
            Unlock App <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
