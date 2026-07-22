import React from 'react';
import { useSeries } from '../context/SeriesContext';
import { KeyRound, X } from 'lucide-react';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { settings, updateSettings } = useSeries();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-500" />
            App Settings
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="AIzaSy..."
            />
            <p className="text-xs text-slate-500">
              Required to generate episodes and storyboards. Stored safely in your browser.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
              AI Model
            </label>
            <select
              value={settings.modelName}
              onChange={(e) => updateSettings({ modelName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="gemini-3.6-flash">Gemini 3.6 Flash (Latest & Fastest)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Cheap)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced Reasoning)</option>
            </select>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-extrabold transition-all"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
