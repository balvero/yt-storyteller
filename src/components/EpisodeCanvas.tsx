import React, { useState } from 'react';
import { useSeries } from '../context/SeriesContext';
import { generateEpisodeStoryboard, regenerateSingleScene, generateImageToVideoPrompt } from '../services/geminiService';
import { Sparkles, Loader2, ChevronLeft, Download, Film, Type, Image as ImageIcon, Video, Volume2, Check, RefreshCw, Copy, Upload, X, Archive } from 'lucide-react';
import type { StoryboardScene } from '../types';

export const EpisodeCanvas: React.FC = () => {
  const { activeSeries, activeEpisode, setActiveEpisodeId, updateEpisode, settings } = useSeries();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedVoiceover, setCopiedVoiceover] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [regeneratingSceneIdx, setRegeneratingSceneIdx] = useState<number | null>(null);
  const [generatingI2vIdx, setGeneratingI2vIdx] = useState<number | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  if (!activeSeries || !activeEpisode) return null;

  const handleExportImagesZip = async () => {
    const scenesWithImages = activeEpisode.scenes.filter(s => !!s.generatedImageUrl);
    if (scenesWithImages.length === 0) {
      alert('No visual guide images have been added yet. Paste or upload images to your scenes first!');
      return;
    }

    setIsExportingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      scenesWithImages.forEach((s) => {
        if (s.generatedImageUrl) {
          const parts = s.generatedImageUrl.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          const ext = mimeMatch ? mimeMatch[1].split('/')[1] || 'png' : 'png';
          const base64Data = parts[1];

          zip.file(`Scene_${s.sceneNumber}.${ext}`, base64Data, { base64: true });
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const cleanTitle = activeEpisode.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanTitle}_images.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate ZIP archive:', err);
      alert('Failed to export ZIP archive.');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleImageFile = (file: File, idx: number) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        const newScenes = [...activeEpisode.scenes];
        newScenes[idx] = { ...newScenes[idx], generatedImageUrl: dataUrl };
        updateEpisode(activeEpisode.id, { scenes: newScenes });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasteOnScene = (e: React.ClipboardEvent, idx: number) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) handleImageFile(file, idx);
      }
    }
  };

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleRegenerateScene = async (idx: number) => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings first.');
      return;
    }
    const scene = activeEpisode.scenes[idx];
    setRegeneratingSceneIdx(idx);
    try {
      const newScene = await regenerateSingleScene(
        activeSeries.topicDescription,
        activeSeries.globalArtStyle,
        activeEpisode.title,
        activeEpisode.conceptOverview,
        scene.sceneNumber,
        scene.timecode,
        settings.geminiApiKey,
        settings.modelName,
        settings.voiceoverLanguage,
        activeSeries.aspectRatio || '9:16'
      );
      updateScene(idx, newScene);
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate scene.');
    } finally {
      setRegeneratingSceneIdx(null);
    }
  };

  const handleGenerateI2vPrompt = async (idx: number) => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings first.');
      return;
    }
    const scene = activeEpisode.scenes[idx];
    setGeneratingI2vIdx(idx);
    try {
      const promptText = await generateImageToVideoPrompt(
        scene.visualDirection,
        scene.voiceoverScript,
        scene.aiPrompts.imagePrompt,
        scene.generatedImageUrl,
        settings.geminiApiKey,
        settings.modelName
      );
      updateScene(idx, {
        ...scene,
        aiPrompts: {
          ...scene.aiPrompts,
          imageToVideoPrompt: promptText
        }
      });
    } catch (err: any) {
      alert(err.message || 'Failed to generate Image-to-Video prompt for Veo.');
    } finally {
      setGeneratingI2vIdx(null);
    }
  };

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
        activeSeries.aspectRatio || '9:16'
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
TEXT-TO-VIDEO PROMPT: ${s.aiPrompts.videoPrompt}
VEO IMAGE-TO-VIDEO PROMPT: ${s.aiPrompts.imageToVideoPrompt || ''}
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
    <div className="max-w-7xl mx-auto p-6 pb-20">
      <button 
        onClick={() => setActiveEpisodeId(null)}
        className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-6 text-sm font-bold"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Series Dashboard
      </button>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8 flex flex-col gap-6">
        <div>
          <span className="text-amber-500 font-bold text-xs uppercase tracking-widest">{activeSeries.title}</span>
          <h2 className="text-2xl font-black text-slate-100 mt-1">{activeEpisode.title}</h2>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">{activeEpisode.conceptOverview}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/80">
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
            onClick={handleExportImagesZip}
            disabled={isExportingZip || !activeEpisode.scenes.some(s => !!s.generatedImageUrl)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors disabled:opacity-50"
            title="Export all scene visual guide images into a ZIP file"
          >
            {isExportingZip ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Archive className="w-4 h-4 text-amber-500" />}
            Export Images (.zip)
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-sm transition-all disabled:opacity-60 shadow-lg shadow-amber-500/10"
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
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 font-black text-sm">
                      {scene.sceneNumber}
                    </div>
                    <span className="text-xs font-bold text-slate-500">{scene.timecode}</span>
                  </div>
                  <button
                    onClick={() => handleRegenerateScene(idx)}
                    disabled={regeneratingSceneIdx === idx}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                    title="Regenerate this specific scene with AI"
                  >
                    {regeneratingSceneIdx === idx ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    Regenerate Scene
                  </button>
                </div>
                
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase"><ImageIcon className="w-3.5 h-3.5" /> Visual Action</label>
                  <textarea 
                    value={scene.visualDirection} 
                    onChange={e => updateScene(idx, { ...scene, visualDirection: e.target.value })}
                    className="w-full bg-transparent border-none text-sm text-slate-300 focus:ring-0 resize-none h-16 p-0"
                  />
                </div>

                {/* Visual Guide Image Container (Paste / Drop / Upload) */}
                <div 
                  onPaste={(e) => handlePasteOnScene(e, idx)}
                  tabIndex={0}
                  className="mt-2 outline-none rounded-xl"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Scene Visual Guide
                    </label>
                    <span className="text-[9px] text-slate-500 font-bold">Paste (Ctrl+V) / Drop</span>
                  </div>

                  {scene.generatedImageUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-48 flex items-center justify-center">
                      <img 
                        src={scene.generatedImageUrl} 
                        alt={`Scene ${scene.sceneNumber} Visual Guide`}
                        className="w-full h-full object-cover max-h-48 rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a 
                          href={scene.generatedImageUrl} 
                          download={`Scene_${scene.sceneNumber}.png`}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 shadow-lg"
                          title="Download Image"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-500" /> Save
                        </a>
                        <label className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer flex items-center gap-1 shadow-lg">
                          <Upload className="w-3.5 h-3.5 text-amber-500" /> Replace
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0], idx)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => updateScene(idx, { ...scene, generatedImageUrl: undefined })}
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1 shadow-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/40 hover:bg-slate-950/80 p-3.5 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                      <Upload className="w-4 h-4 text-slate-600 group-hover:text-amber-500 mb-1 transition-colors" />
                      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Paste or Upload Image</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">Click card & press Ctrl+V to paste</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0], idx)}
                      />
                    </label>
                  )}
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
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-wider">
                      <ImageIcon className="w-3 h-3" /> Step 1: Image Prompt (Midjourney/Flux)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopyText(scene.aiPrompts.imagePrompt, `img-${idx}`)}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition-colors"
                      title="Copy Image Prompt"
                    >
                      {copiedKey === `img-${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <textarea 
                    value={scene.aiPrompts.imagePrompt} 
                    onChange={e => updateScene(idx, { ...scene, aiPrompts: { ...scene.aiPrompts, imagePrompt: e.target.value } })}
                    className="w-full bg-slate-950/50 rounded-lg border border-slate-800 text-[11px] text-slate-400 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none h-16 p-2 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-wider">
                      <Video className="w-3 h-3" /> Text-to-Video Prompt (t2v)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopyText(scene.aiPrompts.videoPrompt, `vid-${idx}`)}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition-colors"
                      title="Copy Text-to-Video Prompt"
                    >
                      {copiedKey === `vid-${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <textarea 
                    value={scene.aiPrompts.videoPrompt} 
                    onChange={e => updateScene(idx, { ...scene, aiPrompts: { ...scene.aiPrompts, videoPrompt: e.target.value } })}
                    className="w-full bg-slate-950/50 rounded-lg border border-slate-800 text-[11px] text-slate-400 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none h-14 p-2 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-wider">
                        <Video className="w-3 h-3 text-amber-400" /> Step 2: Veo Image-to-Video Prompt
                      </label>
                      {scene.generatedImageUrl && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          📷 Image Attached
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateI2vPrompt(idx)}
                        disabled={generatingI2vIdx === idx}
                        className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                        title={scene.generatedImageUrl ? "Analyze attached image and generate Google Veo prompt" : "Generate Google Veo Image-to-Video prompt"}
                      >
                        {generatingI2vIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-400" />
                        )}
                        {scene.generatedImageUrl 
                          ? (scene.aiPrompts.imageToVideoPrompt ? 'Re-analyze Image' : 'Analyze Image & Prompt Veo')
                          : (scene.aiPrompts.imageToVideoPrompt ? 'Regenerate Veo' : 'Generate Veo')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(scene.aiPrompts.imageToVideoPrompt || '', `i2v-${idx}`)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition-colors"
                        title="Copy Veo Image-to-Video Prompt"
                      >
                        {copiedKey === `i2v-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <textarea 
                    value={scene.aiPrompts.imageToVideoPrompt || ''} 
                    placeholder={scene.generatedImageUrl 
                      ? "Click 'Analyze Image & Prompt Veo' to generate camera & motion instructions from your uploaded image..." 
                      : "Step 1: Paste/upload scene image above. Step 2: Click 'Generate Veo' to analyze image & write Veo i2v prompt..."}
                    onChange={e => updateScene(idx, { ...scene, aiPrompts: { ...scene.aiPrompts, imageToVideoPrompt: e.target.value } })}
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


