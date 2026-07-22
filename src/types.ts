export interface StoryboardScene {
  sceneNumber: number;
  timecode: string;
  visualDirection: string;
  onScreenText: string;
  voiceoverScript: string;
  aiPrompts: {
    videoPrompt: string;
    imagePrompt: string;
    imageToVideoPrompt?: string;
    referenceInstruction?: string;
    aspectRatio: string;
  };
}

export interface Episode {
  id: string;
  seriesId: string;
  title: string;
  conceptOverview: string;
  targetDurationSec: number;
  scenes: StoryboardScene[];
  createdAt: string;
  updatedAt: string;
}

export interface Series {
  id: string;
  title: string;
  topicDescription: string;
  globalArtStyle: string;
  targetAudience: string;
  masterReferenceUrl?: string; // e.g. a character sheet or style reference image
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  geminiApiKey: string;
  modelName: string;
  voiceoverLanguage: 'English' | 'Taglish' | 'Tagalog';
  aspectRatio: string;
}
