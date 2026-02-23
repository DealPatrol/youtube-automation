import { NextRequest, NextResponse } from 'next/server';
import { openai, validateOpenAIKey } from '@/lib/openaiClient';

export async function POST(req: NextRequest) {
  try {
    validateOpenAIKey();
    const { topic, style = 'educational', length = 'short' } = await req.json();

    const prompt = `
You are a scriptwriter for short-form vertical videos.
Write a ${length} script about: "${topic}".
Tone: ${style}.
Return only the script text, no headings or commentary.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const script = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ script });
  } catch (error) {
    console.error('[API] Script generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate script' },
      { status: 500 }
    );
  }
}
