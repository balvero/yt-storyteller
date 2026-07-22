import React, { useState } from 'react';
import { useSeries } from '../context/SeriesContext';
import { brainstormEpisodes } from '../services/geminiService';
import { Sparkles, Loader2, Save, BookOpen, Trash2 } from 'lucide-react';

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
  const { activeSeries, updateSeries, deleteSeries, createEpisode, settings } = useSeries();
  const [isSaving, setIsSaving] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormResults, setBrainstormResults] = useState<Array<{ title: string; conceptOverview: string }>>([]);

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
    setBrainstormResults([]);
    try {
      const results = await brainstormEpisodes(
        activeSeries.title,
        activeSeries.topicDescription,
        settings.geminiApiKey,
        settings.modelName,
        3
      );
      setBrainstormResults(results);
    } catch (err: any) {
      alert(err.message || 'Failed to brainstorm episodes.');
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleCreateEpisodeFromConcept = async (concept: { title: string; conceptOverview: string }) => {
    await createEpisode({
      seriesId: activeSeries.id,
      title: concept.title,
      conceptOverview: concept.conceptOverview,
      targetDurationSec: 45,
      scenes: []
    });
    // Remove it from the brainstorm list once created
    setBrainstormResults(prev => prev.filter(c => c.title !== concept.title));
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

      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-100">AI Episode Brainstorming</h3>
          <button
            onClick={handleBrainstorm}
            disabled={isBrainstorming}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-sm transition-all disabled:opacity-60"
          >
            {isBrainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Concepts
          </button>
        </div>

        {brainstormResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {brainstormResults.map((concept, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/50 transition-colors group">
                <div>
                  <h4 className="font-black text-slate-100 text-sm mb-2">{concept.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{concept.conceptOverview}</p>
                </div>
                <button
                  onClick={() => handleCreateEpisodeFromConcept(concept)}
                  className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-amber-500 group-hover:text-slate-900 text-slate-300 font-bold text-xs transition-colors"
                >
                  Create Episode
                </button>
              </div>
            ))}
          </div>
        )}
        
        {brainstormResults.length === 0 && !isBrainstorming && (
          <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center">
            <Sparkles className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Click Generate Concepts to have Gemini pitch episode ideas based on your historical parameters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
