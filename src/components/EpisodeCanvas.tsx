import React, { useState } from 'react';
import { useSeries } from '../context/SeriesContext';
import { generateEpisodeStoryboard } from '../services/geminiService';
import { Sparkles, Loader2, ChevronLeft, Download, Film, Type, Image as ImageIcon, Video, Volume2, Check } from 'lucide-react';
import type { StoryboardScene } from '../types';

export const EpisodeCanvas: React.FC = () => {
  const { activeSeries, activeEpisode, setActiveEpisodeId, updateEpisode, settings } = useSeries();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedVoiceover, setCopiedVoiceover] = useState(false);

  if (!activeSeries || !activeEpisode) return null;

  const handleCopyVoiceovers = () => {
    const fullVoiceover = activeEpisode.scenes
      .map((s) => s.voiceoverScript.trim())
      .filter(Boolean)
      .join('\n\n');

    navigator.clipboard.writeText(fullVoiceover);
    setCopiedVoiceover(true);
    setTimeout(() => setCopiedVoiceover(false), 2000);
  };

  const handleGenerate = async () => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings first.');
      return;
    }

    setIsGenerating(true);
    try {
      const scenes = await generateEpisodeStoryboard(
        activeSeries.topicDescription,
        activeSeries.globalArtStyle,
        activeSeries.targetAudience,
        activeEpisode.title,
        activeEpisode.conceptOverview,
        activeSeries.masterReferenceUrl,
        settings.geminiApiKey,
        settings.modelName,
        settings.voiceoverLanguage,
        settings.aspectRatio || '9:16'
      );
      updateEpisode(activeEpisode.id, { scenes });
    } catch (err: any) {
      alert(err.message || 'Failed to generate storyboard.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    const text = activeEpisode.scenes.map((s) => `
SCENE ${s.sceneNumber} (${s.timecode})
----------------------------------------
VISUAL: ${s.visualDirection}
TEXT ON SCREEN: ${s.onScreenText}
VOICEOVER: ${s.voiceoverScript}

--- AI PROMPTS ---
IMAGE PROMPT: ${s.aiPrompts.imagePrompt}
VIDEO PROMPT: ${s.aiPrompts.videoPrompt}
`).join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Episode_Storyboard_${activeEpisode.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateScene = (index: number, updatedScene: StoryboardScene) => {
    const newScenes = [...activeEpisode.scenes];
    newScenes[index] = updatedScene;
    updateEpisode(activeEpisode.id, { scenes: newScenes });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 pb-20">
      <button 
        onClick={() => setActiveEpisodeId(null)}
        className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-6 text-sm font-bold"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Series Dashboard
      </button>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <span className="text-amber-500 font-bold text-xs uppercase tracking-widest">{activeSeries.title}</span>
          <h2 className="text-2xl font-black text-slate-100 mt-1">{activeEpisode.title}</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-2xl">{activeEpisode.conceptOverview}</p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={handleCopyVoiceovers}
            disabled={activeEpisode.scenes.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors disabled:opacity-50"
            title="Copy combined scene voiceovers for ElevenLabs"
          >
            {copiedVoiceover ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-amber-500" /> Copy Voiceovers (ElevenLabs)
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={activeEpisode.scenes.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-500" /> Export Script
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-sm transition-all disabled:opacity-60"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {activeEpisode.scenes.length > 0 ? 'Regenerate Storyboard' : 'Generate Storyboard'}
          </button>
        </div>
      </div>

      {activeEpisode.scenes.length === 0 && !isGenerating && (
        <div className="p-12 border-2 border-dashed border-slate-800 rounded-3xl text-center">
          <Film className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">Blank Canvas</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Click "Generate Storyboard" to have the AI write a historically factual, engaging script and consistent image prompts based on your global art style.
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="p-12 border border-slate-800 bg-slate-900 rounded-3xl text-center shadow-2xl">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-2">Writing History...</h3>
          <p className="text-slate-500 text-sm animate-pulse">Consulting the factual guardrails and writing cinematic prompts.</p>
        </div>
      )}

      {!isGenerating && activeEpisode.scenes.length > 0 && (
        <div className="space-y-6">
          {activeEpisode.scenes.map((scene, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col md:flex-row gap-6">
              
              {/* Scene Number / Visuals */}
              <div className="w-full md:w-1/3 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 font-black text-sm">
                    {scene.sceneNumber}
                  </div>
                  <span className="text-xs font-bold text-slate-500">{scene.timecode}</span>
                </div>
                
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase"><ImageIcon className="w-3.5 h-3.5" /> Visual Action</label>
                  <textarea 
                    value={scene.visualDirection} 
                    onChange={e => updateScene(idx, { ...scene, visualDirection: e.target.value })}
                    className="w-full bg-transparent border-none text-sm text-slate-300 focus:ring-0 resize-none h-20 p-0"
                  />
                </div>
              </div>

              {/* Scripts */}
              <div className="w-full md:w-1/3 space-y-4 md:border-l border-slate-800 md:pl-6">
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-500/10 w-max px-2 py-0.5 rounded-full"><Type className="w-3 h-3" /> Voiceover</label>
                  <textarea 
                    value={scene.voiceoverScript} 
                    onChange={e => updateScene(idx, { ...scene, voiceoverScript: e.target.value })}
                    className="w-full bg-transparent border-none text-[15px] font-medium text-slate-100 focus:ring-0 resize-none h-24 p-0 leading-relaxed"
                  />
                </div>
                <div className="space-y-1 pt-2 border-t border-slate-800/50">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-wider bg-blue-500/10 w-max px-2 py-0.5 rounded-full block mb-1">Caption / Text</label>
                  <input 
                    value={scene.onScreenText} 
                    onChange={e => updateScene(idx, { ...scene, onScreenText: e.target.value })}
                    className="w-full bg-transparent border-none text-sm font-bold text-blue-100 focus:ring-0 p-0"
                  />
                </div>
              </div>

              {/* AI Prompts */}
              <div className="w-full md:w-1/3 space-y-4 md:border-l border-slate-800 md:pl-6">
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-wider"><ImageIcon className="w-3 h-3" /> Image Prompt (Midjourney/Flux)</label>
                  <textarea 
                    value={scene.aiPrompts.imagePrompt} 
                    onChange={e => updateScene(idx, { ...scene, aiPrompts: { ...scene.aiPrompts, imagePrompt: e.target.value } })}
                    className="w-full bg-slate-950/50 rounded-lg border border-slate-800 text-[11px] text-slate-400 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none h-20 p-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-wider"><Video className="w-3 h-3" /> Video Prompt (Runway/Kling)</label>
                  <textarea 
                    value={scene.aiPrompts.videoPrompt} 
                    onChange={e => updateScene(idx, { ...scene, aiPrompts: { ...scene.aiPrompts, videoPrompt: e.target.value } })}
                    className="w-full bg-slate-950/50 rounded-lg border border-slate-800 text-[11px] text-slate-400 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none h-16 p-2 font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
