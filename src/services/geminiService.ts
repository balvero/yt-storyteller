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
  count: number = 3,
  startEpisodeNumber: number = 1,
  existingEpisodeTitles: string[] = []
): Promise<Array<{ title: string; conceptOverview: string }>> {
  if (!apiKey) throw new Error('API key is missing.');
  
  const ai = new GoogleGenerativeAI(apiKey);
  const existingContext = existingEpisodeTitles.length > 0
    ? `Already produced episodes in this series:\n${existingEpisodeTitles.map(t => `- ${t}`).join('\n')}\n\nMake sure the new episodes logically continue the series timeline/narrative and DO NOT repeat topics covered in existing episodes.`
    : 'This is the start of the series.';

  const prompt = `
${FACTUAL_GUARDRAIL}

I am producing a YouTube series.
Series Title: "${seriesTitle}"
Series Context & Topic: "${topicDescription}"

${existingContext}

Generate exactly ${count} NEW compelling Episode Concepts for this series.
Starting Episode Number: ${startEpisodeNumber}

Number the titles sequentially starting from Episode ${startEpisodeNumber} (e.g. "Episode ${startEpisodeNumber}: [Catchy Title]", "Episode ${startEpisodeNumber + 1}: [Catchy Title]", etc.).

Return ONLY valid JSON matching this structure:
[
  {
    "title": "Episode ${startEpisodeNumber}: [Catchy Title]",
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

export async function regenerateSingleConcept(
  seriesTitle: string,
  topicDescription: string,
  apiKey: string,
  modelName: string = 'gemini-3.6-flash'
): Promise<{ title: string; conceptOverview: string }> {
  if (!apiKey) throw new Error('API key is missing.');
  
  const ai = new GoogleGenerativeAI(apiKey);
  const prompt = `
${FACTUAL_GUARDRAIL}

I am producing a YouTube series.
Series Title: "${seriesTitle}"
Series Context & Topic: "${topicDescription}"

Generate 1 fresh, compelling Episode Concept for this series focusing on a specific micro-story or historical event.

Return ONLY valid JSON matching this structure:
{
  "title": "Episode: [Catchy Title]",
  "conceptOverview": "A 2-3 sentence overview of the historical event and narrative hook."
}
`;

  const model = ai.getGenerativeModel({ model: modelName });
  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
  });

  const text = response.response.text() || '{}';
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse single concept JSON:', text);
    throw new Error('Failed to regenerate concept. Try again.');
  }
}

export async function regenerateSingleScene(
  seriesTopic: string,
  globalArtStyle: string,
  episodeTitle: string,
  episodeConcept: string,
  sceneNumber: number,
  timecode: string,
  apiKey: string,
  modelName: string = 'gemini-3.6-flash',
  voiceoverLanguage: string = 'English',
  aspectRatio: string = '9:16'
): Promise<StoryboardScene> {
  if (!apiKey) throw new Error('API key is missing.');

  const ai = new GoogleGenerativeAI(apiKey);

  const languageInstruction = voiceoverLanguage === 'English'
    ? 'Write the voiceover in dramatic, documentary-style English.'
    : voiceoverLanguage === 'Tagalog'
    ? 'Write the voiceover in dramatic Tagalog (Filipino).'
    : 'Write the voiceover in Taglish (mixed Tagalog-English).';

  const prompt = `
${FACTUAL_GUARDRAIL}

Regenerate Scene #${sceneNumber} for an episode in a YouTube series.
Series Topic: "${seriesTopic}"
Global Art Style: "${globalArtStyle}"
Episode Title: "${episodeTitle}"
Episode Concept: "${episodeConcept}"
Target Timecode: "${timecode}"

INSTRUCTIONS:
1. Provide a brand new, dramatic, and historically accurate visual direction, voiceover script, and on-screen text for Scene ${sceneNumber}.
2. ${languageInstruction}
3. The image prompt MUST start with "${globalArtStyle}" and end with "--ar ${aspectRatio}".

Return ONLY valid JSON matching:
{
  "sceneNumber": ${sceneNumber},
  "timecode": "${timecode}",
  "visualDirection": "...",
  "onScreenText": "...",
  "voiceoverScript": "...",
  "aiPrompts": {
    "videoPrompt": "...",
    "imagePrompt": "${globalArtStyle}, ... --ar ${aspectRatio}",
    "aspectRatio": "${aspectRatio}"
  }
}
`;

  const model = ai.getGenerativeModel({ model: modelName });
  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
  });

  const text = response.response.text() || '{}';
  try {
    const sc = JSON.parse(text);
    return {
      sceneNumber: sc.sceneNumber || sceneNumber,
      timecode: sc.timecode || timecode,
      visualDirection: sc.visualDirection || '',
      onScreenText: sc.onScreenText || '',
      voiceoverScript: sc.voiceoverScript || '',
      aiPrompts: {
        videoPrompt: sc.aiPrompts?.videoPrompt || '',
        imagePrompt: sc.aiPrompts?.imagePrompt || '',
        imageToVideoPrompt: sc.aiPrompts?.imageToVideoPrompt || '',
        referenceInstruction: sc.aiPrompts?.referenceInstruction || '',
        aspectRatio: sc.aiPrompts?.aspectRatio || aspectRatio
      }
    };
  } catch (err) {
    console.error('Failed to parse single scene JSON:', text);
    throw new Error('Failed to regenerate scene. Try again.');
  }
}
