import { NextRequest, NextResponse } from 'next/server';
import { shotstackRequest } from '@/lib/shotstackClient';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const data = await shotstackRequest<any>(`/render/${id}`, {
      method: 'GET',
    });

    return NextResponse.json({
      id: data.response?.id,
      status: data.response?.status,
      url: data.response?.url,
    });
  } catch (error) {
    console.error('[API] Render status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get render status' },
      { status: 500 }
    );
  }
}
