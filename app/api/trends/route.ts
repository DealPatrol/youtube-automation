import { NextRequest, NextResponse } from 'next/server';
import { trendAnalyzer } from '@/lib/trends/trend-scraper';
import type { ApiResponse, Platform } from '@/lib/types';

/**
 * GET /api/trends
 * Get trending topics by platform
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = (searchParams.get('platform') || 'youtube') as Platform;
    const opportunities = searchParams.get('opportunities') === 'true';

    let trends;

    if (opportunities) {
      // Get low-competition opportunities
      trends = await trendAnalyzer.getOpportunitiesTrends();
    } else {
      // Get trends for specific platform
      trends = await trendAnalyzer.getTrends(platform);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          platform: opportunities ? 'all' : platform,
          trends: trends.map((t) => ({
            id: t.id,
            platform: t.platform,
            topic: t.topic,
            category: t.category,
            search_volume: t.search_volume,
            growth_percentage: t.growth_percentage,
            competition_level: t.competition_level,
            suggested_format: t.suggested_format,
            fetched_at: t.fetched_at,
          })),
          count: trends.length,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>
    );
  } catch (error) {
    console.error('[v0] Trends API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trends',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

/**
 * POST /api/trends/refresh
 * Manually trigger trend analysis and refresh
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (optional - could add admin check)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    // Trigger analysis
    await trendAnalyzer.analyzeTrends();

    return NextResponse.json(
      {
        success: true,
        data: { message: 'Trends refreshed successfully' },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>,
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Trend refresh error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh trends',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
