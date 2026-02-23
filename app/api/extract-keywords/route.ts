import { NextRequest, NextResponse } from 'next/server';
import { openai, validateOpenAIKey } from '@/lib/openaiClient';

export async function POST(req: NextRequest) {
  try {
    validateOpenAIKey();
    const { script } = await req.json();

    const prompt = `
You are preparing a script for a short-form video with on-screen text overlays.

Given this script:

"""${script}"""

1. Break it into 6–12 scenes.
2. For each scene, return:
   - "overlay_text": a short, punchy phrase (max 12 words) to show on screen.
   - "keywords": 2–4 keywords for stock video search.
   - "length": approximate duration in seconds (between 3 and 7).

Return a JSON array only, no explanation. Example:

[
  {
    "overlay_text": "This is the hook",
    "keywords": ["city", "night", "lights"],
    "length": 5
  }
]
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let scenes;
    try {
      const parsed = JSON.parse(raw);
      scenes = Array.isArray(parsed) ? parsed : parsed.scenes || [];
    } catch {
      scenes = [];
    }

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error('[API] Scene extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract scenes' },
      { status: 500 }
    );
  }
}
