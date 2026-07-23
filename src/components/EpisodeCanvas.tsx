import React, { useState } from 'react';
import { useSeries } from '../context/SeriesContext';
import { generateEpisodeStoryboard, regenerateSingleScene, generateImageToVideoPrompt, generateYouTubeMetadata } from '../services/geminiService';
import { Sparkles, Loader2, ChevronLeft, Download, Film, Type, Image as ImageIcon, Video, Volume2, Check, RefreshCw, Copy, Upload, X, Archive, Youtube, Tag, FileText, CheckCircle2 } from 'lucide-react';
import type { StoryboardScene } from '../types';

export const EpisodeCanvas: React.FC = () => {
  const { activeSeries, activeEpisode, setActiveEpisodeId, updateEpisode, settings } = useSeries();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [copiedVoiceover, setCopiedVoiceover] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [regeneratingSceneIdx, setRegeneratingSceneIdx] = useState<number | null>(null);
  const [generatingI2vIdx, setGeneratingI2vIdx] = useState<number | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  if (!activeSeries || !activeEpisode) return null;

  const handleVideoUpload = (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file (.mp4, .mov, .webm).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        updateEpisode(activeEpisode.id, {
          finishedVideoUrl: dataUrl,
          finishedVideoName: file.name,
          finishedVideoSize: file.size
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const getExtensionFromDataUrl = (dataUrl: string, fallback: string): string => {
    const parts = dataUrl.split(',');
    if (!parts[0]) return fallback;
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return fallback;
    const mime = mimeMatch[1];
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('mp4')) return 'mp4';
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('quicktime') || mime.includes('mov')) return 'mov';
    return fallback;
  };

  const handleExportEpisodeZip = async () => {
    const hasImages = activeEpisode.scenes.some(s => !!s.generatedImageUrl);
    const hasSceneVideos = activeEpisode.scenes.some(s => !!s.generatedVideoUrl);
    const hasFinishedVideo = !!activeEpisode.finishedVideoUrl;

    if (!hasImages && !hasSceneVideos && !hasFinishedVideo && activeEpisode.scenes.length === 0) {
      alert('No scenes or media assets available to export for this episode.');
      return;
    }

    setIsExportingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const cleanSeriesName = activeSeries.title.replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'Series';
      const cleanEpisodeTitle = activeEpisode.title.replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'Episode';

      const baseFolderPath = `${cleanSeriesName}/${cleanEpisodeTitle}`;

      // 1. Images: Series Name > Episode Title > Images > scene_1.jpg
      activeEpisode.scenes.forEach((s) => {
        if (s.generatedImageUrl) {
          const ext = getExtensionFromDataUrl(s.generatedImageUrl, 'jpg');
          const parts = s.generatedImageUrl.split(',');
          if (parts[1]) {
            zip.file(`${baseFolderPath}/Images/scene_${s.sceneNumber}.${ext}`, parts[1], { base64: true });
          }
        }
      });

      // 2. Videos (Scene Clips): Series Name > Episode Title > Videos > scene_1.mp4
      activeEpisode.scenes.forEach((s) => {
        if (s.generatedVideoUrl) {
          const ext = getExtensionFromDataUrl(s.generatedVideoUrl, 'mp4');
          const parts = s.generatedVideoUrl.split(',');
          if (parts[1]) {
            zip.file(`${baseFolderPath}/Videos/scene_${s.sceneNumber}.${ext}`, parts[1], { base64: true });
          }
        }
      });

      // 3. Finished Video: Series Name > Episode Title > Videos > final_episode.mp4
      if (activeEpisode.finishedVideoUrl) {
        const ext = getExtensionFromDataUrl(activeEpisode.finishedVideoUrl, 'mp4');
        const parts = activeEpisode.finishedVideoUrl.split(',');
        if (parts[1]) {
          zip.file(`${baseFolderPath}/Videos/final_episode.${ext}`, parts[1], { base64: true });
        }
      }

      // 4. Storyboard Script & Metadata Text File
      const effectivePlTitle = activeEpisode.youtubeMetadata?.playlistTitle || activeSeries.playlistTitle || '';
      const effectivePlDesc = activeEpisode.youtubeMetadata?.playlistDescription || activeSeries.playlistDescription || '';

      const ytSection = activeEpisode.youtubeMetadata ? `
========================================
YOUTUBE PUBLISHING & PLAYLIST METADATA
========================================
VIDEO TITLE:
${activeEpisode.youtubeMetadata.youtubeTitle}

VIDEO DESCRIPTION:
${activeEpisode.youtubeMetadata.description}

TAGS:
${(activeEpisode.youtubeMetadata.tags || []).join(', ')}

----------------------------------------
PLAYLIST SEO METADATA
----------------------------------------
PLAYLIST TITLE:
${effectivePlTitle}

PLAYLIST DESCRIPTION:
${effectivePlDesc}

========================================
STORYBOARD SCRIPT & AI PROMPTS
========================================
` : '';

      const scriptText = ytSection + activeEpisode.scenes.map((s) => `
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

      zip.file(`${baseFolderPath}/storyboard_script.txt`, scriptText);

      const content = await zip.generateAsync({ type: 'blob' });
      const zipName = `${cleanSeriesName}_${cleanEpisodeTitle}_Assets.zip`.replace(/\s+/g, '_');
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate assets ZIP archive:', err);
      alert('Failed to export assets ZIP archive.');
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
        const targetScene = newScenes[idx];
        const autoComplete = !!targetScene.generatedVideoUrl;
        newScenes[idx] = {
          ...targetScene,
          generatedImageUrl: dataUrl,
          isSceneCompleted: autoComplete ? true : targetScene.isSceneCompleted
        };
        updateEpisode(activeEpisode.id, { scenes: newScenes });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSceneVideoFile = (file: File, idx: number) => {
    if (!file.type.startsWith('video/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        const newScenes = [...activeEpisode.scenes];
        const targetScene = newScenes[idx];
        const autoComplete = !!targetScene.generatedImageUrl;
        newScenes[idx] = {
          ...targetScene,
          generatedVideoUrl: dataUrl,
          generatedVideoName: file.name,
          isSceneCompleted: autoComplete ? true : targetScene.isSceneCompleted
        };
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

  const handleGenerateMetadata = async () => {
    if (!settings.geminiApiKey) {
      alert('Please enter your Gemini API Key in Settings first.');
      return;
    }
    setIsGeneratingMetadata(true);
    try {
      const metadata = await generateYouTubeMetadata(
        activeSeries.title,
        activeSeries.topicDescription,
        activeEpisode.title,
        activeEpisode.conceptOverview,
        activeEpisode.scenes,
        settings.geminiApiKey,
        settings.modelName
      );

      const finalMetadata = {
        ...metadata,
        playlistTitle: metadata.playlistTitle || activeSeries.playlistTitle || `${activeSeries.title} | Full Series`,
        playlistDescription: metadata.playlistDescription || activeSeries.playlistDescription || activeSeries.topicDescription
      };

      updateEpisode(activeEpisode.id, { youtubeMetadata: finalMetadata });
    } catch (err: any) {
      alert(err.message || 'Failed to generate YouTube metadata.');
    } finally {
      setIsGeneratingMetadata(false);
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
    const effectivePlTitle = activeEpisode.youtubeMetadata?.playlistTitle || activeSeries.playlistTitle || '';
    const effectivePlDesc = activeEpisode.youtubeMetadata?.playlistDescription || activeSeries.playlistDescription || '';

    const ytSection = activeEpisode.youtubeMetadata ? `
========================================
YOUTUBE PUBLISHING & PLAYLIST METADATA
========================================
VIDEO TITLE:
${activeEpisode.youtubeMetadata.youtubeTitle}

VIDEO DESCRIPTION:
${activeEpisode.youtubeMetadata.description}

TAGS:
${(activeEpisode.youtubeMetadata.tags || []).join(', ')}

----------------------------------------
PLAYLIST SEO METADATA
----------------------------------------
PLAYLIST TITLE:
${effectivePlTitle}

PLAYLIST DESCRIPTION:
${effectivePlDesc}

========================================
STORYBOARD SCRIPT & AI PROMPTS
========================================
` : '';

    const text = ytSection + activeEpisode.scenes.map((s) => `
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

  const completedScenesCount = activeEpisode.scenes.filter(
    s => s.isSceneCompleted || (s.generatedImageUrl && s.generatedVideoUrl)
  ).length;
  const totalScenesCount = activeEpisode.scenes.length;
  const progressPercent = totalScenesCount > 0 ? Math.round((completedScenesCount / totalScenesCount) * 100) : 0;

  const currentPlTitle = activeEpisode.youtubeMetadata?.playlistTitle || activeSeries.playlistTitle || '';
  const currentPlDesc = activeEpisode.youtubeMetadata?.playlistDescription || activeSeries.playlistDescription || '';

  return (
    <div className="max-w-7xl mx-auto p-6 pb-20">
      <button 
        onClick={() => setActiveEpisodeId(null)}
        className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-6 text-sm font-bold"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Series Dashboard
      </button>

      {/* Episode Header */}
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
            onClick={handleExportEpisodeZip}
            disabled={isExportingZip}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-sm transition-colors disabled:opacity-50"
            title="Export full episode media assets & script into organized folder hierarchy ZIP"
          >
            {isExportingZip ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Archive className="w-4 h-4 text-amber-400" />}
            Export Episode Assets (.zip)
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

      {/* Finished Episode Video Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                Finished Episode Video Asset
              </h3>
              <p className="text-xs text-slate-400">Upload & store your final rendered video file for this episode</p>
            </div>
          </div>

          {activeEpisode.finishedVideoUrl && (
            <div className="flex items-center gap-2">
              <a
                href={activeEpisode.finishedVideoUrl}
                download={activeEpisode.finishedVideoName || `${activeEpisode.title.replace(/\s+/g, '_')}_Final.mp4`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
                title="Download finished video"
              >
                <Download className="w-3.5 h-3.5 text-amber-500" /> Save Video
              </a>
              <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-500" /> Replace Video
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete the finished video file for this episode?')) {
                    updateEpisode(activeEpisode.id, {
                      finishedVideoUrl: undefined,
                      finishedVideoName: undefined,
                      finishedVideoSize: undefined
                    });
                  }
                }}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Remove video"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {activeEpisode.finishedVideoUrl ? (
          <div className="mt-6 flex flex-col md:flex-row gap-6 items-center">
            {/* Video Player */}
            <div className="w-full md:w-1/2 rounded-xl overflow-hidden border border-slate-800 bg-black shadow-2xl flex items-center justify-center max-h-96">
              <video
                src={activeEpisode.finishedVideoUrl}
                controls
                className="w-full max-h-96 object-contain rounded-xl"
              />
            </div>

            {/* Video Details */}
            <div className="w-full md:w-1/2 space-y-4">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block mb-1">File Name</span>
                  <p className="text-sm font-bold text-slate-200 break-all">{activeEpisode.finishedVideoName || 'Episode_Final.mp4'}</p>
                </div>

                {activeEpisode.finishedVideoSize && (
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">File Size</span>
                    <p className="text-xs font-mono font-bold text-slate-400">
                      {(activeEpisode.finishedVideoSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">Asset Status</span>
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Video Ready for Upload
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/40 hover:bg-slate-950/80 p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
              <Upload className="w-8 h-8 text-slate-600 group-hover:text-amber-500 mb-3 transition-colors" />
              <h4 className="text-sm font-bold text-slate-300 group-hover:text-slate-100 transition-colors">
                Upload Finished Episode Video (.mp4, .mov, .webm)
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Store your final rendered video file right inside this episode for easy playback and organization.
              </p>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
              />
            </label>
          </div>
        )}
      </div>

      {/* YouTube Shorts Publishing & SEO Metadata Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                YouTube Publishing & SEO Metadata
              </h3>
              <p className="text-xs text-slate-400">Viral title, search-optimized description, playlist metadata, and tags for YouTube Shorts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateMetadata}
            disabled={isGeneratingMetadata}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs transition-all disabled:opacity-50"
          >
            {isGeneratingMetadata ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Sparkles className="w-3.5 h-3.5" />}
            {activeEpisode.youtubeMetadata ? 'Regenerate Metadata' : 'Generate YouTube Metadata'}
          </button>
        </div>

        {activeEpisode.youtubeMetadata ? (
          <div className="mt-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Youtube className="w-3.5 h-3.5 text-red-400" /> Shorts Title
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyText(activeEpisode.youtubeMetadata?.youtubeTitle || '', 'yt-title')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {copiedKey === 'yt-title' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Title
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={activeEpisode.youtubeMetadata.youtubeTitle}
                onChange={(e) => {
                  const updated = { ...activeEpisode.youtubeMetadata!, youtubeTitle: e.target.value };
                  updateEpisode(activeEpisode.id, { youtubeMetadata: updated });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Viral YouTube Shorts Title with hashtags..."
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" /> Video Description
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyText(activeEpisode.youtubeMetadata?.description || '', 'yt-desc')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {copiedKey === 'yt-desc' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Description
                    </>
                  )}
                </button>
              </div>
              <textarea
                rows={5}
                value={activeEpisode.youtubeMetadata.description}
                onChange={(e) => {
                  const updated = { ...activeEpisode.youtubeMetadata!, description: e.target.value };
                  updateEpisode(activeEpisode.id, { youtubeMetadata: updated });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans"
                placeholder="SEO description, hook, story details, call to action, and hashtags..."
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-400" /> SEO Tags
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyText((activeEpisode.youtubeMetadata?.tags || []).join(', '), 'yt-tags')}
                  className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {copiedKey === 'yt-tags' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied All Tags!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Tags (Comma-Separated)
                    </>
                  )}
                </button>
              </div>
              <textarea
                rows={2}
                value={(activeEpisode.youtubeMetadata.tags || []).join(', ')}
                onChange={(e) => {
                  const newTags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  const updated = { ...activeEpisode.youtubeMetadata!, tags: newTags };
                  updateEpisode(activeEpisode.id, { youtubeMetadata: updated });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                placeholder="tag1, tag2, tag3..."
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(activeEpisode.youtubeMetadata.tags || []).map((tag, tIdx) => (
                  <span key={tIdx} className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Playlist Title & SEO Description */}
            <div className="pt-4 border-t border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                    YouTube Playlist Metadata (Series / Season Playlist)
                  </h4>
                </div>

                {(activeSeries.playlistTitle || activeSeries.playlistDescription) && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...activeEpisode.youtubeMetadata!,
                        playlistTitle: activeSeries.playlistTitle || activeEpisode.youtubeMetadata?.playlistTitle || '',
                        playlistDescription: activeSeries.playlistDescription || activeEpisode.youtubeMetadata?.playlistDescription || ''
                      };
                      updateEpisode(activeEpisode.id, { youtubeMetadata: updated });
                      alert('Synced Playlist Title & Description from Series Profile!');
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                    title="Copy Series Playlist metadata to this episode"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" /> Sync from Series Profile
                  </button>
                )}
              </div>

              {/* Playlist Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    Playlist Title
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyText(currentPlTitle, 'yt-pl-title')}
                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    {copiedKey === 'yt-pl-title' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Playlist Title
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={currentPlTitle}
                  onChange={(e) => {
                    const updated = { ...activeEpisode.youtubeMetadata!, playlistTitle: e.target.value };
                    updateEpisode(activeEpisode.id, { youtubeMetadata: updated });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="SEO Optimized Playlist Title (e.g. Biblical History Secrets | YouTube Shorts Series)"
                />
              </div>

              {/* Playlist SEO Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    Playlist SEO Description
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyText(currentPlDesc, 'yt-pl-desc')}
                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    {copiedKey === 'yt-pl-desc' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Playlist Description
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={currentPlDesc}
                  onChange={(e) => {
                    const updated = { ...activeEpisode.youtubeMetadata!, playlistDescription: e.target.value };
                    updateEpisode(activeEpisode.id, { youtubeMetadata: updated });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans"
                  placeholder="SEO optimized playlist description summarizing the full series, call to subscribe, and target keyword phrases..."
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-6 border border-dashed border-slate-800 rounded-xl text-center">
            <p className="text-xs text-slate-500 mb-3">No YouTube publishing metadata generated yet for this episode.</p>
            <button
              type="button"
              onClick={handleGenerateMetadata}
              disabled={isGeneratingMetadata}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs transition-colors disabled:opacity-50"
            >
              {isGeneratingMetadata ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate YouTube Title, Description & Tags
            </button>
          </div>
        )}
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
          {/* Storyboard Progress Header */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 flex items-center gap-2">
                  Scene Completion Progress
                </h4>
                <p className="text-xs text-slate-400">
                  {completedScenesCount} of {totalScenesCount} scenes complete ({progressPercent}%)
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 bg-slate-950 border border-slate-800 h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>

          {activeEpisode.scenes.map((scene, idx) => {
            const isBothUploaded = !!scene.generatedImageUrl && !!scene.generatedVideoUrl;
            const isDone = scene.isSceneCompleted ?? isBothUploaded;

            return (
              <div key={idx} className={`bg-slate-900 border rounded-2xl p-6 shadow-lg flex flex-col md:flex-row gap-6 transition-all ${
                isDone ? 'border-emerald-500/40 bg-slate-900/90 shadow-emerald-950/20' : 'border-slate-800'
              }`}>
                
                {/* Scene Visuals & Assets (Image + Video) */}
                <div className="w-full md:w-1/3 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 font-black text-xs">
                        {scene.sceneNumber}
                      </div>
                      <span className="text-xs font-bold text-slate-500">{scene.timecode}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextDone = !isDone;
                          updateScene(idx, { ...scene, isSceneCompleted: nextDone });
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
                        }`}
                        title={isBothUploaded ? "Both Image & Video uploaded (Scene Complete)" : "Click to toggle scene completion"}
                      >
                        <CheckCircle2 className={`w-3 h-3 ${isDone ? 'text-emerald-400' : 'text-slate-500'}`} />
                        {isDone ? 'Complete' : 'Mark Complete'}
                      </button>

                      <button
                        onClick={() => handleRegenerateScene(idx)}
                        disabled={regeneratingSceneIdx === idx}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                        title="Regenerate this scene with AI"
                      >
                        {regeneratingSceneIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-amber-500" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase"><ImageIcon className="w-3.5 h-3.5" /> Visual Action</label>
                    <textarea 
                      value={scene.visualDirection} 
                      onChange={e => updateScene(idx, { ...scene, visualDirection: e.target.value })}
                      className="w-full bg-transparent border-none text-sm text-slate-300 focus:ring-0 resize-none h-14 p-0"
                    />
                  </div>

                  {/* 1. Scene Visual Guide Image */}
                  <div 
                    onPaste={(e) => handlePasteOnScene(e, idx)}
                    tabIndex={0}
                    className="outline-none rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Scene Image Guide
                      </label>
                      <span className="text-[9px] text-slate-500 font-bold">Paste / Drop</span>
                    </div>

                    {scene.generatedImageUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-36 flex items-center justify-center">
                        <img 
                          src={scene.generatedImageUrl} 
                          alt={`Scene ${scene.sceneNumber} Visual Guide`}
                          className="w-full h-full object-cover max-h-36 rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a 
                            href={scene.generatedImageUrl} 
                            download={`Scene_${scene.sceneNumber}.png`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 shadow-lg"
                            title="Download Image"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-500" /> Save
                          </a>
                          <label className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer flex items-center gap-1 shadow-lg">
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
                            onClick={() => {
                              updateScene(idx, {
                                ...scene,
                                generatedImageUrl: undefined,
                                isSceneCompleted: false
                              });
                            }}
                            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1 shadow-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                        <Upload className="w-4 h-4 text-slate-600 group-hover:text-amber-500 mb-1 transition-colors" />
                        <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Paste/Upload Image</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0], idx)}
                        />
                      </label>
                    )}
                  </div>

                  {/* 2. Scene Video Clip Asset */}
                  <div className="outline-none rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <Video className="w-3 h-3" /> Scene Video Clip
                      </label>
                      {scene.generatedVideoUrl && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Video Clip Loaded
                        </span>
                      )}
                    </div>

                    {scene.generatedVideoUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-black max-h-36 flex items-center justify-center">
                        <video 
                          src={scene.generatedVideoUrl} 
                          controls
                          className="w-full h-full object-contain max-h-36 rounded-xl"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10 bg-black/80 p-1 rounded-lg border border-slate-700">
                          <a 
                            href={scene.generatedVideoUrl} 
                            download={scene.generatedVideoName || `Scene_${scene.sceneNumber}_Clip.mp4`}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1"
                            title="Save Video Clip"
                          >
                            <Download className="w-3 h-3 text-amber-500" />
                          </a>
                          <label className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer flex items-center gap-1">
                            <Upload className="w-3 h-3 text-amber-500" />
                            <input 
                              type="file" 
                              accept="video/*" 
                              className="hidden" 
                              onChange={(e) => e.target.files?.[0] && handleSceneVideoFile(e.target.files[0], idx)}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              updateScene(idx, {
                                ...scene,
                                generatedVideoUrl: undefined,
                                generatedVideoName: undefined,
                                isSceneCompleted: false
                              });
                            }}
                            className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                        <Upload className="w-4 h-4 text-slate-600 group-hover:text-amber-500 mb-1 transition-colors" />
                        <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Upload Scene Video Clip</span>
                        <input 
                          type="file" 
                          accept="video/*" 
                          className="hidden" 
                          onChange={(e) => e.target.files?.[0] && handleSceneVideoFile(e.target.files[0], idx)}
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
            );
          })}
        </div>
      )}
    </div>
  );
};
