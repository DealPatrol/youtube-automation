import { NextRequest, NextResponse } from 'next/server';
import { searchPexelsVideo } from '@/lib/pexelsClient';

export async function POST(req: NextRequest) {
  try {
    const { scenes } = await req.json() as {
      scenes: { overlay_text: string; keywords: string[]; length: number }[];
    };

    const results = [];

    for (const scene of scenes) {
      const query = scene.keywords.join(' ');
      const clipUrl = await searchPexelsVideo(query);
      results.push({
        ...scene,
        clipUrl,
      });
    }

    return NextResponse.json({ scenes: results });
  } catch (error) {
    console.error('[API] Clip search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find clips' },
      { status: 500 }
    );
  }
}
