import React, { useState } from 'react';
import { useSeries } from '../context/SeriesContext';
import { KeyRound, X, Download, Upload, Database } from 'lucide-react';
import { db } from '../db';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { settings, updateSettings } = useSeries();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleBackup = async () => {
    try {
      const allSeries = await db.series.toArray();
      const allEpisodes = await db.episodes.toArray();
      const backupObject = {
        app: 'YouTubeShortsStoryteller',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        series: allSeries,
        episodes: allEpisodes,
        settings: settings
      };

      const jsonStr = JSON.stringify(backupObject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `yt_storyteller_backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
      alert('Failed to export backup.');
    }
  };

  const handleRestoreFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsRestoring(true);
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.series || !Array.isArray(data.series) || !data.episodes || !Array.isArray(data.episodes)) {
          alert('Invalid backup file format.');
          return;
        }

        const shouldOverwrite = confirm(
          `Backup contains ${data.series.length} series and ${data.episodes.length} episodes.\n\nClick OK to OVERWRITE existing local data, or CANCEL to MERGE with existing data.`
        );

        if (shouldOverwrite) {
          await db.series.clear();
          await db.episodes.clear();
        }

        await db.series.bulkPut(data.series);
        await db.episodes.bulkPut(data.episodes);

        if (data.settings) {
          updateSettings(data.settings);
        }

        alert(`Successfully restored ${data.series.length} series and ${data.episodes.length} episodes!`);
      } catch (err) {
        console.error('Failed to restore backup:', err);
        alert('Error parsing backup JSON file.');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-500" />
            App Settings & Data
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
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

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
              Default Aspect Ratio
            </label>
            <select
              value={settings.aspectRatio || '9:16'}
              onChange={(e) => updateSettings({ aspectRatio: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="9:16">9:16 (Vertical / Shorts / Reels / TikTok)</option>
              <option value="16:9">16:9 (Horizontal / Standard YouTube)</option>
              <option value="1:1">1:1 (Square / Instagram)</option>
              <option value="4:5">4:5 (Portrait Feed)</option>
            </select>
            <p className="text-xs text-slate-500">
              Included directly in image & video generation prompts (e.g. --ar 9:16).
            </p>
          </div>

          {/* Backup / Restore Section */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wide">
              <Database className="w-4 h-4 text-amber-500" /> Backup & Restore Data
            </label>
            <p className="text-xs text-slate-400">
              Export all your series, episodes, storyboards, and image visual guides to a JSON file to transfer between devices or save backups.
            </p>
            
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleBackup}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
              >
                <Download className="w-4 h-4 text-amber-500" /> Export Backup
              </button>

              <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700 cursor-pointer">
                <Upload className="w-4 h-4 text-amber-500" />
                {isRestoring ? 'Restoring...' : 'Restore Backup'}
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleRestoreFile(e.target.files[0])}
                  disabled={isRestoring}
                />
              </label>
            </div>
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
