'use server';

import { createTrendingTopic, getTrendingTopics } from '../db/queries';
import type { TrendingTopic, Platform, VideoFormat } from '../types';

interface TrendAnalysisResult {
  platform: Platform;
  topic: string;
  searchVolume: number;
  growthPercentage: number;
  competitionLevel: 'low' | 'medium' | 'high';
  suggestedFormat: VideoFormat;
  category: string;
}

/**
 * Trend analysis service
 * Analyzes trending topics from YouTube, TikTok, Twitter
 * Suggests video formats and content angles
 */
export class TrendAnalyzer {
  /**
   * Fetch trending topics from YouTube
   * In production, this would use YouTube API or a scraping service
   */
  async fetchYouTubeTrends(): Promise<TrendAnalysisResult[]> {
    try {
      console.log('[v0] Fetching YouTube trends...');

      // Mock trending topics for demonstration
      // In production, use youtube-api or youtube-scraper npm package
      const mockTrends: TrendAnalysisResult[] = [
        {
          platform: 'youtube',
          topic: 'AI automation tools',
          searchVolume: 45000,
          growthPercentage: 156,
          competitionLevel: 'high',
          suggestedFormat: 'long-form',
          category: 'Technology',
        },
        {
          platform: 'youtube',
          topic: 'Remote work setups',
          searchVolume: 32000,
          growthPercentage: 89,
          competitionLevel: 'medium',
          suggestedFormat: 'tutorial',
          category: 'Lifestyle',
        },
        {
          platform: 'youtube',
          topic: 'Personal finance hacks',
          searchVolume: 28000,
          growthPercentage: 124,
          competitionLevel: 'medium',
          suggestedFormat: 'short',
          category: 'Finance',
        },
      ];

      return mockTrends;
    } catch (error) {
      console.error('[v0] YouTube trends fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch trending topics from TikTok
   */
  async fetchTikTokTrends(): Promise<TrendAnalysisResult[]> {
    try {
      console.log('[v0] Fetching TikTok trends...');

      // Mock trending topics
      // In production, use tiktok-scraper or similar npm package
      const mockTrends: TrendAnalysisResult[] = [
        {
          platform: 'tiktok',
          topic: 'Productivity hacks',
          searchVolume: 125000,
          growthPercentage: 89,
          competitionLevel: 'high',
          suggestedFormat: 'short',
          category: 'Lifestyle',
        },
        {
          platform: 'tiktok',
          topic: 'Life lessons from gen z',
          searchVolume: 95000,
          growthPercentage: 156,
          competitionLevel: 'medium',
          suggestedFormat: 'short',
          category: 'Education',
        },
        {
          platform: 'tiktok',
          topic: 'DIY home hacks',
          searchVolume: 78000,
          growthPercentage: 102,
          competitionLevel: 'medium',
          suggestedFormat: 'short',
          category: 'Lifestyle',
        },
      ];

      return mockTrends;
    } catch (error) {
      console.error('[v0] TikTok trends fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch trending topics from Twitter/X
   */
  async fetchTwitterTrends(): Promise<TrendAnalysisResult[]> {
    try {
      console.log('[v0] Fetching Twitter trends...');

      // Mock trending topics
      // In production, use twitter-api or tweepy
      const mockTrends: TrendAnalysisResult[] = [
        {
          platform: 'twitter',
          topic: 'Crypto market updates',
          searchVolume: 65000,
          growthPercentage: 78,
          competitionLevel: 'high',
          suggestedFormat: 'long-form',
          category: 'Finance',
        },
        {
          platform: 'twitter',
          topic: 'Tech industry news',
          searchVolume: 52000,
          growthPercentage: 92,
          competitionLevel: 'high',
          suggestedFormat: 'long-form',
          category: 'Technology',
        },
      ];

      return mockTrends;
    } catch (error) {
      console.error('[v0] Twitter trends fetch failed:', error);
      return [];
    }
  }

  /**
   * Analyze and store trends in database
   */
  async analyzeTrends(): Promise<void> {
    try {
      console.log('[v0] Starting trend analysis...');

      const [youtubeTrends, tiktokTrends, twitterTrends] = await Promise.all([
        this.fetchYouTubeTrends(),
        this.fetchTikTokTrends(),
        this.fetchTwitterTrends(),
      ]);

      const allTrends = [...youtubeTrends, ...tiktokTrends, ...twitterTrends];

      // Store in database
      for (const trend of allTrends) {
        await createTrendingTopic({
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          platform: trend.platform,
          topic: trend.topic,
          category: trend.category,
          search_volume: trend.searchVolume,
          growth_percentage: trend.growthPercentage,
          competition_level: trend.competitionLevel,
          suggested_format: trend.suggestedFormat,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expire in 24 hours
        });
      }

      console.log('[v0] Trend analysis complete. Stored', allTrends.length, 'trends');
    } catch (error) {
      console.error('[v0] Trend analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get trending topics for a specific platform
   */
  async getTrends(platform: Platform): Promise<TrendingTopic[]> {
    try {
      const trends = await getTrendingTopics(platform, 20);

      // If no recent trends, analyze and fetch fresh ones
      if (trends.length === 0) {
        await this.analyzeTrends();
        return getTrendingTopics(platform, 20);
      }

      return trends;
    } catch (error) {
      console.error('[v0] Failed to get trends:', error);
      return [];
    }
  }

  /**
   * Get trending topics with lowest competition
   * Useful for finding untapped viral opportunities
   */
  async getOpportunitiesTrends(): Promise<TrendingTopic[]> {
    try {
      const allPlatforms: Platform[] = ['youtube', 'tiktok', 'twitter'];
      let opportunities: TrendingTopic[] = [];

      for (const platform of allPlatforms) {
        const trends = await getTrendingTopics(platform, 20);
        opportunities = opportunities.concat(
          trends.filter((t) => t.competition_level === 'low' || t.competition_level === 'medium')
        );
      }

      // Sort by growth percentage (highest first)
      return opportunities.sort((a, b) => (b.growth_percentage || 0) - (a.growth_percentage || 0));
    } catch (error) {
      console.error('[v0] Failed to get opportunities:', error);
      return [];
    }
  }

  /**
   * Estimate difficulty of competing in a trending topic
   */
  estimateCompetitionDifficulty(topic: TrendingTopic): 'easy' | 'medium' | 'hard' {
    const volume = topic.search_volume || 0;
    const competition = topic.competition_level || 'medium';

    if (competition === 'low') return 'easy';
    if (competition === 'high' && volume > 100000) return 'hard';
    return 'medium';
  }

  /**
   * Suggest best platform for a trend
   */
  suggestBestPlatform(topic: TrendingTopic): Platform {
    // YouTube for long-form, TikTok for short-form, Twitter for news/tech
    if (topic.suggested_format === 'long-form' || topic.suggested_format === 'true-crime') {
      return 'youtube';
    } else if (topic.suggested_format === 'short') {
      return 'tiktok';
    }

    return topic.platform;
  }
}

// Export singleton instance
export const trendAnalyzer = new TrendAnalyzer();
