import { NextRequest, NextResponse } from 'next/server';
import { shotstackRequest } from '@/lib/shotstackClient';
import { buildScenesFromAI } from '@/lib/buildScenes';
import { buildDualTimelines } from '@/lib/buildTimeline';
import { openai } from '@/lib/openaiClient';
import { searchPexelsVideo } from '@/lib/pexelsClient';
import { generateVoiceover } from '@/lib/elevenLabsClient';

export async function POST(req: NextRequest) {
  try {
    const { topic, style = 'educational', length = 'short' } = await req.json();

    console.log('[API] Starting video render for topic:', topic);

    // 1) Generate script
    const scriptPrompt = `
You are a scriptwriter for short-form vertical videos.
Write a ${length} script about: "${topic}".
Tone: ${style}.
Return only the script text.
`;
    const scriptCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: scriptPrompt }],
    });
    const script = scriptCompletion.choices[0]?.message?.content?.trim() || '';
    console.log('[API] Generated script');

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

    return NextResponse.json({
      script,
      scenes,
      portraitRenderId: portraitRender.response.id,
      landscapeRenderId: landscapeRender.response.id,
    });
  } catch (error) {
    console.error('[API] Video render error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    );
  }
}
