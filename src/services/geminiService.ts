import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StoryboardScene } from '../types';

const FACTUAL_GUARDRAIL = `
CRITICAL SYSTEM INSTRUCTION: ZERO-HALLUCINATION FACTUAL GUARDRAIL
You are acting as an expert, rigorous historian and documentary scriptwriter. 
1. STRICT ACCURACY: You must NEVER invent, fictionalize, or hallucinate events, people, dates, or artifacts. Everything in the narrative must be grounded in verified historical, scientific, or factual evidence related to the topic.
2. NO DRAMATIZATION OF FACTS: While the tone should be engaging and dramatic, the facts themselves cannot be altered for dramatic effect. If a detail is unknown or unverified by historical consensus, use plausible generalizations rather than making up specifics.
3. DISTINGUISH MYTH FROM HISTORY: If the topic covers mythology or religious texts, clearly contextualize the narrative (e.g. "According to ancient records..." or "Archaeologists discovered...").
`;

export async function brainstormEpisodes(
  seriesTitle: string,
  topicDescription: string,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash',
  count: number = 3
): Promise<Array<{ title: string; conceptOverview: string }>> {
  if (!apiKey) throw new Error('API key is missing.');
  
  const ai = new GoogleGenerativeAI(apiKey);
  const prompt = `
${FACTUAL_GUARDRAIL}

I am producing a YouTube Shorts series.
Series Title: "${seriesTitle}"
Series Context & Topic: "${topicDescription}"

Generate exactly ${count} compelling Episode Concepts for this series. Each concept should focus on a specific, fascinating micro-story or historical event that fits within the larger series topic.

Return ONLY valid JSON matching this structure:
[
  {
    "title": "Episode 1: [Catchy Title]",
    "conceptOverview": "A 2-3 sentence overview of the historical event and the narrative hook for the short."
  }
]
`;

  const model = ai.getGenerativeModel({ model: modelName });
  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
  });

  const text = response.response.text() || '[]';
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    return parsed;
  } catch (err) {
    console.error('Failed to parse brainstorm JSON:', text);
    throw new Error('Failed to generate episode concepts. Ensure your API key is correct and try again.');
  }
}

export async function generateEpisodeStoryboard(
  seriesTopic: string,
  globalArtStyle: string,
  targetAudience: string,
  episodeTitle: string,
  episodeConcept: string,
  masterReferenceUrl: string | undefined,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash',
  voiceoverLanguage: string = 'English',
  aspectRatio: string = '9:16'
): Promise<StoryboardScene[]> {
  if (!apiKey) throw new Error('API key is missing.');

  const ai = new GoogleGenerativeAI(apiKey);
  
  const srefInstruction = masterReferenceUrl 
    ? 'Attach the Master Reference Image using `--sref` (Midjourney) or as an Image Prompt (Flux) to maintain character/style consistency.'
    : 'Apply the Global Art Style prompt to maintain visual consistency.';

  const languageInstruction = voiceoverLanguage === 'English'
    ? 'Write the voiceover in dramatic, documentary-style English.'
    : voiceoverLanguage === 'Tagalog'
    ? 'Write the voiceover in dramatic Tagalog (Filipino).'
    : 'Write the voiceover in Taglish (mixed Tagalog-English).';

  const prompt = `
${FACTUAL_GUARDRAIL}

You are generating a scene-by-scene storyboard for a video with a ${aspectRatio} aspect ratio.
Series Topic: "${seriesTopic}"
Global Art Style: "${globalArtStyle}"
Target Audience: "${targetAudience}"
Target Aspect Ratio: "${aspectRatio}"

Episode Title: "${episodeTitle}"
Episode Concept: "${episodeConcept}"

INSTRUCTIONS:
1. Break down the episode into 4 to 6 scenes. Total video duration should be around 30-60 seconds.
2. The Hook (Scene 1) must instantly grab the audience's attention with a compelling visual and opening line.
3. ${languageInstruction} The voiceover must be historically/factually accurate and gripping.
4. Generate AI Image and Video prompts for each scene. Every image prompt MUST begin with the Global Art Style and end with "--ar ${aspectRatio}" (e.g. "${globalArtStyle}, [scene detail] --ar ${aspectRatio}") to enforce visual consistency and frame aspect ratio across Midjourney, Flux, Runway, and Kling.

Return ONLY valid JSON matching this exact structure:
[
  {
    "sceneNumber": 1,
    "timecode": "0:00 - 0:05",
    "visualDirection": "Describe what is happening in the scene visually...",
    "onScreenText": "Bold caption overlay...",
    "voiceoverScript": "The historically accurate narrator script...",
    "aiPrompts": {
      "videoPrompt": "Prompt for Runway Gen-3/Kling describing camera movement...",
      "imagePrompt": "${globalArtStyle}, [specific scene details] --ar ${aspectRatio}",
      "referenceInstruction": "${srefInstruction}",
      "aspectRatio": "${aspectRatio}"
    }
  }
]
`;

  const model = ai.getGenerativeModel({ model: modelName });
  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
  });

  const text = response.response.text() || '[]';
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    return parsed.map((sc: any, idx: number) => ({
      sceneNumber: sc.sceneNumber || idx + 1,
      timecode: sc.timecode || '',
      visualDirection: sc.visualDirection || '',
      onScreenText: sc.onScreenText || '',
      voiceoverScript: sc.voiceoverScript || '',
      aiPrompts: {
        videoPrompt: sc.aiPrompts?.videoPrompt || '',
        imagePrompt: sc.aiPrompts?.imagePrompt || '',
        imageToVideoPrompt: sc.aiPrompts?.imageToVideoPrompt || '',
        referenceInstruction: sc.aiPrompts?.referenceInstruction || '',
        aspectRatio: sc.aiPrompts?.aspectRatio || '9:16'
      }
    }));
  } catch (err) {
    console.error('Failed to parse storyboard JSON:', text);
    throw new Error('Failed to generate the storyboard. Try again.');
  }
}
