import React, { useState } from 'react';
import { useSeries } from '../context/SeriesContext';
import { brainstormEpisodes, regenerateSingleConcept } from '../services/geminiService';
import { Sparkles, Loader2, Save, BookOpen, Trash2, Film, RefreshCw, ChevronRight, Plus, Hash, CheckCircle2 } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

const ART_STYLE_PRESETS = [
  {
    label: 'Comic Book (Default: Modern American & DC/Marvel)',
    prompt: 'Modern American and DC Marvel comic book art style, clean cel-shading, bold ink outlines, realistic human anatomy, vivid color gradients'
  },
  {
    label: 'Cinematic 3D Animation (Pixar / DreamWorks)',
    prompt: 'Cinematic 3D Animation, Pixar and DreamWorks style, highly detailed textures, warm volumetric lighting, expressive character design'
  },
  {
    label: 'Dark Historical Oil Painting (Rembrandt)',
    prompt: 'Dark Historical Oil Painting, Rembrandt lighting, rich chiaroscuro, textured canvas brushstrokes, dramatic atmospheric depth'
  },
  {
    label: 'Retro 90s Anime (Ghibli Inspired)',
    prompt: 'Retro Anime / 90s Cel Animation, Ghibli inspired, soft watercolor backgrounds, vintage color palette, nostalgic film grain'
  }
];

export const SeriesDashboard: React.FC = () => {
  const { activeSeries, updateSeries, deleteSeries, createEpisode, updateEpisode, deleteEpisode, renumberSeriesEpisodes, setActiveEpisodeId, settings } = useSeries();
  const [isSaving, setIsSaving] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [generateCount, setGenerateCount] = useState<number>(3);
  const [regeneratingEpId, setRegeneratingEpId] = useState<string | null>(null);

  const episodes = useLiveQuery(
    () => activeSeries ? db.episodes.where({ seriesId: activeSeries.id }).sortBy('createdAt') : [],
    [activeSeries?.id]
  ) || [];

  if (!activeSeries) return null;

  const currentPresetMatch = ART_STYLE_PRESETS.find(p => p.prompt === activeSeries.globalArtStyle);
  const selectedPresetLabel = currentPresetMatch ? currentPresetMatch.label : 'custom';

  const handlePresetChange = (presetValue: string) => {
    if (presetValue === 'custom') return;
    updateSeries(activeSeries.id, { globalArtStyle: presetValue });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleBrainstorm = async () => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings first.');
      return;
    }
    if (!activeSeries.topicDescription) {
      alert('Please write a detailed topic description for the series first.');
      return;
    }

    setIsBrainstorming(true);
    const startEpNumber = episodes.length + 1;
    const existingTitles = episodes.map(e => e.title);

    try {
      const results = await brainstormEpisodes(
        activeSeries.title,
        activeSeries.topicDescription,
        settings.geminiApiKey,
        settings.modelName,
        generateCount,
        startEpNumber,
        existingTitles
      );
      
      const normalize = (str: string) => str.replace(/^Episode\s*\d+:\s*/i, '').trim().toLowerCase();
      const seenTitles = new Set(episodes.map(e => normalize(e.title)));
      let currentEpNum = episodes.length + 1;

      // Deduplicate and save unique episodes
      for (const concept of results) {
        const normTitle = normalize(concept.title);
        if (seenTitles.has(normTitle)) {
          console.warn('Skipping duplicate episode concept:', concept.title);
          continue;
        }
        seenTitles.add(normTitle);

        const coreTitle = concept.title.replace(/^Episode\s*\d+:\s*/i, '').trim();
        const formattedTitle = `Episode ${currentEpNum}: ${coreTitle}`;
        currentEpNum++;

        await createEpisode({
          seriesId: activeSeries.id,
          title: formattedTitle,
          conceptOverview: concept.conceptOverview,
          targetDurationSec: 45,
          scenes: []
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to brainstorm episodes.');
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleRegenerateConcept = async (epId: string) => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings first.');
      return;
    }
    setRegeneratingEpId(epId);
    try {
      const newConcept = await regenerateSingleConcept(
        activeSeries.title,
        activeSeries.topicDescription,
        settings.geminiApiKey,
        settings.modelName
      );
      await updateEpisode(epId, {
        title: newConcept.title,
        conceptOverview: newConcept.conceptOverview
      });
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate episode concept.');
    } finally {
      setRegeneratingEpId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-100 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-amber-500" />
            Series Master Profile
          </h2>
          <p className="text-slate-400 mt-1">Define the lore, history, and visual style for your episodes.</p>
        </div>
        <button
          onClick={() => {
            if (confirm('Delete this entire series and all its episodes?')) {
              deleteSeries(activeSeries.id);
            }
          }}
          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
          title="Delete Series"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Series Title</label>
            <input
              type="text"
              value={activeSeries.title}
              onChange={(e) => updateSeries(activeSeries.id, { title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Target Aspect Ratio</label>
            <select
              value={activeSeries.aspectRatio || '9:16'}
              onChange={(e) => updateSeries(activeSeries.id, { aspectRatio: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="9:16">9:16 (Vertical / Shorts / Reels / TikTok)</option>
              <option value="16:9">16:9 (Horizontal / Standard YouTube)</option>
              <option value="1:1">1:1 (Square / Instagram)</option>
              <option value="4:5">4:5 (Portrait Feed)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Global Art Style</label>
            <span className="text-xs text-amber-500 font-medium">Applied to every AI image prompt</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Choose Style Preset</label>
              <select
                value={selectedPresetLabel}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {ART_STYLE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.prompt}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">✍️ Custom / User Defined Style</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Active Art Style Prompt (Editable)</label>
              <textarea
                value={activeSeries.globalArtStyle}
                onChange={(e) => updateSeries(activeSeries.id, { globalArtStyle: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-none font-mono leading-relaxed"
                placeholder="Enter custom art style description..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
            Master Topic & Factual Guardrails
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Write a highly detailed description of the historical era, facts, and boundaries for this series. The AI will use this as its absolute truth.
          </p>
          <textarea
            value={activeSeries.topicDescription}
            onChange={(e) => updateSeries(activeSeries.id, { topicDescription: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 min-h-[200px]"
            placeholder="e.g. True historical events from the Patriarchal Age... Emphasize archaeological discoveries..."
          />
        </div>

        <div className="flex items-center justify-end">
          <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </form>

      <div className="mt-12 space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h3 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
              <Film className="w-5 h-5 text-amber-500" />
              Series Episodes ({episodes.length})
            </h3>
            <p className="text-xs text-slate-400 mt-1">Saved episode concepts and storyboards for this series.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => renumberSeriesEpisodes(activeSeries.id)}
              disabled={episodes.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors disabled:opacity-50"
              title="Clean up and re-number all episodes chronologically (Episode 1, Episode 2, ...)"
            >
              <Hash className="w-3.5 h-3.5 text-amber-500" /> Fix Numbers
            </button>
            
            <button
              onClick={async () => {
                await createEpisode({
                  seriesId: activeSeries.id,
                  title: `Episode ${episodes.length + 1}: Custom Concept`,
                  conceptOverview: 'Write your custom episode concept description here...',
                  targetDurationSec: 45,
                  scenes: []
                });
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
            >
              <Plus className="w-4 h-4 text-amber-500" /> Manual Episode
            </button>

            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Count:</span>
              <select
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="bg-transparent text-slate-200 text-xs font-black focus:outline-none cursor-pointer"
              >
                <option value={1} className="bg-slate-900 text-slate-200">1 Episode</option>
                <option value={3} className="bg-slate-900 text-slate-200">3 Episodes</option>
                <option value={5} className="bg-slate-900 text-slate-200">5 Episodes</option>
                <option value={10} className="bg-slate-900 text-slate-200">10 Episodes</option>
              </select>
            </div>

            <button
              onClick={handleBrainstorm}
              disabled={isBrainstorming}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-xs transition-all disabled:opacity-60 shadow-lg shadow-amber-500/10"
            >
              {isBrainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate {generateCount} AI Concept{generateCount > 1 ? 's' : ''}
            </button>
          </div>
        </div>

        {isBrainstorming && (
          <div className="p-8 border border-slate-800 bg-slate-900 rounded-2xl text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-3" />
            <p className="text-slate-300 font-bold text-sm">Brainstorming & Saving {generateCount} New Episode{generateCount > 1 ? 's' : ''}...</p>
            <p className="text-xs text-slate-500 mt-1">Consulting historical guardrails to craft micro-stories.</p>
          </div>
        )}

        {episodes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {episodes.map((ep) => {
              const isRegeneratingThis = regeneratingEpId === ep.id;
              const hasStoryboard = ep.scenes && ep.scenes.length > 0;

              return (
                <div key={ep.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <input
                        type="text"
                        value={ep.title}
                        onChange={(e) => updateEpisode(ep.id, { title: e.target.value })}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1 text-sm font-black text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                        hasStoryboard ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {hasStoryboard ? `${ep.scenes.length} Scenes` : 'Draft'}
                      </span>
                    </div>

                    <textarea
                      value={ep.conceptOverview}
                      onChange={(e) => updateEpisode(ep.id, { conceptOverview: e.target.value })}
                      rows={3}
                      className="w-full bg-transparent border-none text-xs text-slate-400 leading-relaxed resize-none focus:ring-0 p-0 mb-3"
                    />

                    {/* Uploaded / Completion Status */}
                    <div className="flex items-center justify-between bg-slate-950/40 p-2 rounded-xl border border-slate-800/80 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          const nextCompleted = !ep.isCompleted;
                          const today = new Date().toISOString().split('T')[0];
                          updateEpisode(ep.id, {
                            isCompleted: nextCompleted,
                            completedAt: nextCompleted ? (ep.completedAt || today) : undefined
                          });
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                          ep.isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${ep.isCompleted ? 'text-emerald-400' : 'text-slate-500'}`} />
                        {ep.isCompleted ? 'Uploaded' : 'Mark Uploaded'}
                      </button>

                      {ep.isCompleted && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Date:</span>
                          <input
                            type="date"
                            value={ep.completedAt || new Date().toISOString().split('T')[0]}
                            onChange={(e) => updateEpisode(ep.id, { completedAt: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded-md px-2 py-0.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Regenerate Concept Icon Button */}
                    <div className="relative group">
                      <button
                        onClick={() => handleRegenerateConcept(ep.id)}
                        disabled={isRegeneratingThis}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 flex items-center justify-center"
                        aria-label="Regenerate Concept with AI"
                      >
                        {isRegeneratingThis ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <RefreshCw className="w-4 h-4 text-amber-500" />}
                      </button>
                      <div className="absolute bottom-full mb-2 left-0 hidden group-hover:block bg-slate-950 text-slate-200 text-[10px] font-bold py-1 px-2.5 rounded-md whitespace-nowrap shadow-xl border border-slate-700 z-20 pointer-events-none">
                        Regenerate Concept with AI
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Delete Episode Icon Button */}
                      <div className="relative group">
                        <button
                          onClick={() => deleteEpisode(ep.id)}
                          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex items-center justify-center"
                          aria-label="Delete Episode"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-950 text-red-400 text-[10px] font-bold py-1 px-2.5 rounded-md whitespace-nowrap shadow-xl border border-slate-700 z-20 pointer-events-none">
                          Delete Episode
                        </div>
                      </div>
                      
                      {/* Open Storyboard Icon Button */}
                      <div className="relative group">
                        <button
                          onClick={() => setActiveEpisodeId(ep.id)}
                          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-black transition-all flex items-center justify-center shadow-lg shadow-amber-500/10"
                          aria-label="Open Storyboard Canvas"
                        >
                          <ChevronRight className="w-4 h-4 stroke-[3]" />
                        </button>
                        <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block bg-slate-950 text-amber-400 text-[10px] font-bold py-1 px-2.5 rounded-md whitespace-nowrap shadow-xl border border-slate-700 z-20 pointer-events-none">
                          Open Storyboard Canvas
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {episodes.length === 0 && !isBrainstorming && (
          <div className="p-10 border-2 border-dashed border-slate-800 rounded-2xl text-center">
            <Sparkles className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-sm mb-1">No Saved Episodes Yet</p>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Click "Generate 3 AI Concepts" to brainstorm and save new historical micro-stories, or click "Manual Episode" to write your own.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
