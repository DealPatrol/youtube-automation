import { NextRequest, NextResponse } from 'next/server';
import { generateVoiceover } from '@/lib/elevenLabsClient';

export async function POST(req: NextRequest) {
  try {
    const { script } = await req.json();

    const audioBuffer = await generateVoiceover(script);
    const base64 = audioBuffer.toString('base64');
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return NextResponse.json({ audioUrl: dataUrl });
  } catch (error) {
    console.error('[API] Voiceover generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate voiceover' },
      { status: 500 }
    );
  }
}
