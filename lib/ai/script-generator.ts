'use server';

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { VideoFormat } from '../types';
import { getPromptForFormat } from './prompts';
import { createScript, updateScript } from '../db/queries';

// Define the schema for script generation responses
const SceneSchema = z.object({
  number: z.number(),
  title: z.string(),
  duration_seconds: z.number(),
  voiceover: z.string(),
  broll_suggestions: z.array(z.string()).optional(),
  on_screen_text: z.array(z.string()).optional(),
  music_style: z.string().optional(),
  mood: z.string().optional(),
  tips: z.array(z.string()).optional(),
  common_mistakes: z.array(z.string()).optional(),
  sound_design: z.string().optional(),
});

const ScriptResponseSchema = z.object({
  title: z.string(),
  hook: z.string().optional(),
  intro_hook: z.string().optional(),
  intro: z.string().optional(),
  scenes: z.array(SceneSchema),
  total_duration_seconds: z.number(),
  estimated_word_count: z.number().optional(),
  trending_angle: z.string().optional(),
  seo_keywords: z.array(z.string()).optional(),
  cta: z.string().optional(),
  conclusion: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  steps: z.array(SceneSchema).optional(),
  dramatization_level: z.string().optional(),
  difficulty_level: z.string().optional(),
  resources_mentioned: z.array(z.string()).optional(),
  trending_elements: z.array(z.string()).optional(),
});

export interface ScriptGenerationRequest {
  topic: string;
  format: VideoFormat;
  duration?: number;
  tone?: string;
  trendingAngle?: string;
  // Strategy context (from YouTube Strategy Studio)
  strategyContext?: {
    niche: string;
    targetAudience: string;
    contentPillar: string;
    monetizationAngle: string;
  };
}

export interface GeneratedScript {
  id: string;
  title: string;
  content: unknown;
  duration_seconds: number;
  format: VideoFormat;
}

/**
 * Generate a video script using Claude AI
 * This function calls Claude's API with format-specific prompts
 */
export async function generateVideoScript(
  userId: string,
  request: ScriptGenerationRequest
): Promise<GeneratedScript> {
  console.log('[v0] Starting script generation for topic:', request.topic, 'format:', request.format);

  // Default to 600 seconds (10 minutes) for long-form, 45 seconds for shorts
  const duration = request.duration || (request.format === 'short' ? 45 : 600);

  // Step 1: Create a draft script record in the database
  const scriptRecord = await createScript(userId, {
    topic: request.topic,
    format: request.format,
    duration_target: duration,
    tone: request.tone,
    trending_angle: request.trendingAngle,
  });

  console.log('[v0] Created script record:', scriptRecord.id);

  try {
    // Step 2: Get the formatted prompt for this video format
    let prompt = getPromptForFormat(
      request.format,
      request.topic,
      duration,
      request.trendingAngle
    );

    // Step 2.5: Enhance prompt with strategy context if provided
    if (request.strategyContext) {
      console.log('[v0] Enhancing script with strategy context from YouTube Strategy Studio');
      const { niche, targetAudience, contentPillar, monetizationAngle } = request.strategyContext;
      prompt += `\n\n**CHANNEL CONTEXT (from YouTube Strategy Studio):**
- Channel Niche: ${niche}
- Target Audience: ${targetAudience}
- Content Pillar: ${contentPillar}
- Monetization Angle: ${monetizationAngle}

Adapt the script to align with this channel's identity, audience, and monetization strategy.`;
    }

    // Step 3: Call Claude with structured output
    console.log('[v0] Calling Claude API with prompt for format:', request.format);

    const result = await generateObject({
      model: anthropic('claude-3-5-sonnet-20241022'),
      schema: ScriptResponseSchema,
      prompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    console.log('[v0] Claude returned script successfully');

    // Step 4: Update the script record with the generated content
    const updatedScript = await updateScript(
      scriptRecord.id,
      userId,
      {
        script_text: result.object.title, // Store title as main text
        script_json: result.object, // Store full structured output
        duration_seconds: result.object.total_duration_seconds || duration,
      }
    );

    console.log('[v0] Script generation complete:', scriptRecord.id);

    return {
      id: scriptRecord.id,
      title: result.object.title,
      content: result.object,
      duration_seconds: result.object.total_duration_seconds || duration,
      format: request.format,
    };
  } catch (error) {
    console.error('[v0] Script generation failed:', error);

    // Update the script record with error status
    await updateScript(
      scriptRecord.id,
      userId,
      {
        script_text: `Error: ${error instanceof Error ? error.message : 'Unknown error during script generation'}`,
      }
    );

    throw error;
  }
}

/**
 * Estimate the cost of script generation based on Claude API pricing
 * Current Claude 3.5 Sonnet pricing: $3/1M input tokens, $15/1M output tokens
 */
export function estimateScriptCost(durationSeconds: number): number {
  // Rough estimate: ~1 token per 4 characters, output typically ~1500 tokens
  // Base cost: ~$0.01-0.02 per script (very cheap)
  // We'll charge a fixed $0.50 as a nominal fee for script generation
  return 0.50;
}
