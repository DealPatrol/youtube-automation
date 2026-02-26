import { NextRequest, NextResponse } from 'next/server';
import { shotstackRequest } from '@/lib/shotstackClient';
import { buildScenesFromAI } from '@/lib/buildScenes';
import { buildDualTimelines } from '@/lib/buildTimeline';
import { openai, validateOpenAIKey } from '@/lib/openaiClient';
import { searchPexelsVideo } from '@/lib/pexelsClient';
import { generateVoiceover } from '@/lib/elevenLabsClient';

export async function POST(req: NextRequest) {
  try {
    // Validate required API keys at request time, not module load
    try {
      validateOpenAIKey();
    } catch (e) {
      console.error('[API] OpenAI key validation failed:', e);
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const { topic, style = 'educational', length = 'short' } = await req.json();

    console.log('[API] Starting video render for topic:', topic);
    console.log('[API] OpenAI client exists:', !!openai);

    // 1) Generate script
    const scriptPrompt = `
You are a scriptwriter for short-form vertical videos.
Write a ${length} script about: "${topic}".
Tone: ${style}.
Return only the script text.
`;
    console.log('[API] Calling OpenAI for script generation...');
    const scriptCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: scriptPrompt }],
    });
    const script = scriptCompletion.choices[0]?.message?.content?.trim() || '';
    console.log('[API] Generated script:', script.substring(0, 100));

    if (!script) {
      console.error('[API] Script generation returned empty string');
      return NextResponse.json(
        { error: 'Failed to generate script - empty response from OpenAI' },
        { status: 500 }
      );
    }

    // 2) Extract scenes
    const scenePrompt = `
You are preparing a script for a short-form video with on-screen text overlays.

Given this script:

"""${script}"""

1. Break it into 6–12 scenes.
2. For each scene, return:
   - "overlay_text": a short, punchy phrase (max 12 words).
   - "keywords": 2–4 keywords for stock video search.
   - "length": approximate duration in seconds (3–7).

Return a JSON array only.
`;
    const sceneCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: scenePrompt }],
      response_format: { type: 'json_object' },
    });

    let aiScenes: { overlay_text: string; keywords: string[]; length: number }[] = [];
    try {
      const raw = sceneCompletion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      aiScenes = Array.isArray(parsed) ? parsed : parsed.scenes || [];
    } catch (e) {
      console.error('[API] Failed to parse AI scenes', e);
    }
    console.log('[API] Extracted', aiScenes.length, 'scenes');

    // 3) Fetch clips from Pexels
    const scenesWithClips = [];
    for (const s of aiScenes) {
      const query = s.keywords.join(' ');
      const clipUrl = await searchPexelsVideo(query);
      scenesWithClips.push({ ...s, clipUrl });
    }
    console.log('[API] Found clips for scenes');

    // 4) Generate voiceover
    let audioUrl: string | null = null;
    try {
      const audioBuffer = await generateVoiceover(script);
      const base64 = audioBuffer.toString('base64');
      audioUrl = `data:audio/mpeg;base64,${base64}`;
      console.log('[API] Generated voiceover');
    } catch (e) {
      console.warn('[API] Voiceover generation failed, continuing without audio:', e);
    }

    // 5) Build scenes
    const scenes = buildScenesFromAI(scenesWithClips);

    // 6) Build dual timelines
    const { portrait, landscape } = buildDualTimelines(scenes, audioUrl);

    // 7) Send to Shotstack
    let portraitRender, landscapeRender;
    try {
      portraitRender = await shotstackRequest<{ response: { id: string } }>('/render', {
        method: 'POST',
        body: JSON.stringify(portrait),
      });

      landscapeRender = await shotstackRequest<{ response: { id: string } }>('/render', {
        method: 'POST',
        body: JSON.stringify(landscape),
      });
      console.log('[API] Sent to Shotstack for rendering');
    } catch (e) {
      console.warn('[API] Shotstack rendering failed:', e);
      return NextResponse.json(
        { error: 'Video rendering not configured. Please add Shotstack API key.' },
        { status: 500 }
      );
    }

    // Generate result ID
    const resultId = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Format script for UI
    const formattedScript = {
      title: topic || 'Untitled Video',
      duration: Math.ceil(scenes.reduce((sum, s) => sum + s.length, 0) / 60),
      content: script,
      sections: scenes.map((scene, idx) => ({
        time: `${Math.floor(scene.start / 60)}:${String(scene.start % 60).padStart(2, '0')}`,
        speaker: 'Narrator',
        text: scene.text,
      })),
    };

    // Format scenes for UI
    const formattedScenes = scenes.map((scene, idx) => ({
      id: scene.id,
      sceneNumber: idx + 1,
      overlayText: scene.text,
      keywords: scene.keywords,
      duration: scene.length,
      clipUrl: scene.clipUrl,
      startTime: scene.start,
    }));

    return NextResponse.json({
      resultId,
      script: formattedScript,
      scenes: formattedScenes,
      portraitRenderId: portraitRender.response.id,
      landscapeRenderId: landscapeRender.response.id,
      processing_status: 'completed',
      capcut_steps: [],
      seo: {
        title: topic,
        description: script.substring(0, 150),
        keywords: aiScenes.flatMap(s => s.keywords).slice(0, 10),
      },
      thumbnail: null,
    });
  } catch (error) {
    console.error('[API] Video render error:', error);
    console.error('[API] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[API] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[API] Full error:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to render video',
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}
