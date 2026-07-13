import type { VideoFormat } from '../types';

export const SCRIPT_PROMPTS: Record<VideoFormat, string> = {
  'long-form': `You are a professional YouTube content creator specializing in engaging long-form videos (8-15 minutes).

Create a detailed video script for the following topic: {topic}

Requirements:
- Total duration: {duration} seconds (~{minutes} minutes)
- Include a hook in the first 10 seconds to grab attention
- Structure: Hook → Story/Setup → Main Content (3-5 key points) → Conclusion → CTA
- Add timestamps for scene breaks every 60-90 seconds
- Include detailed voiceover text that's engaging and conversational
- Suggest B-roll shots, graphics, and on-screen text overlays
- Include natural transitions between sections
- End with a strong call-to-action

Format your response as valid JSON with this exact structure:
{
  "title": "Video title",
  "hook": "First 10-second script to grab attention",
  "scenes": [
    {
      "number": 1,
      "title": "Scene title",
      "duration_seconds": 60,
      "voiceover": "Conversational voiceover text",
      "broll_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
      "on_screen_text": ["Text overlay 1", "Text overlay 2"]
    }
  ],
  "total_duration_seconds": {duration},
  "estimated_word_count": 0,
  "trending_angle": "{trending_angle}",
  "seo_keywords": ["keyword1", "keyword2", "keyword3"],
  "cta": "Final call-to-action"
}`,

  'short': `You are a TikTok/Instagram Reels expert specializing in viral short-form videos (15-60 seconds).

Create a script for a viral short-form video on the topic: {topic}

Requirements:
- Total duration: {duration} seconds (max 60 seconds)
- Hook must be in the FIRST FRAME - make it stop-the-scroll worthy
- Use fast-paced editing with quick scene transitions (2-5 seconds each)
- Trending angle: {trending_angle}
- Include text overlays at key moments
- Suggest trendy audio/music style
- Build to a climax or satisfying conclusion
- Include trending sounds or audio cues if applicable

Format your response as valid JSON:
{
  "title": "Short video concept",
  "hook": "First 1-2 seconds must be WILD",
  "scenes": [
    {
      "number": 1,
      "title": "Scene name",
      "duration_seconds": 3,
      "voiceover": "Brief dialogue (if any)",
      "broll_suggestions": ["fast action shot"],
      "on_screen_text": ["HOOK TEXT"],
      "music_style": "upbeat, trending"
    }
  ],
  "total_duration_seconds": {duration},
  "trending_elements": ["trending_sound_1", "trending_hashtag_1"],
  "seo_keywords": ["keyword1", "keyword2"],
  "cta": "End screen text"
}`,

  'true-crime': `You are a true crime documentary expert. Create a compelling true crime narrative script.

Topic: {topic}

Requirements:
- Duration: {duration} seconds
- Tone: Mysterious, engaging, respectful
- Structure: Introduction/Hook → Background → The Crime → Investigation → Conclusion
- Include dramatic pauses and mood-setting descriptions
- Suggest dark, atmospheric B-roll
- Include interview placeholder text
- Add dramatic music/sound cues
- Trending angle: {trending_angle}

Format as valid JSON:
{
  "title": "Documentary title",
  "intro_hook": "Compelling opening that sets the scene",
  "scenes": [
    {
      "number": 1,
      "title": "Section title",
      "duration_seconds": 0,
      "voiceover": "Narrative voiceover",
      "mood": "tense/mysterious/somber",
      "broll_suggestions": ["documentary footage", "archive images"],
      "sound_design": "eerie music, subtle effects",
      "on_screen_text": ["Dates", "Names", "Key facts"]
    }
  ],
  "total_duration_seconds": {duration},
  "dramatization_level": "documentary/mystery/investigative",
  "cta": "Closing statement"
}`,

  'tutorial': `You are a professional tutorial creator specializing in educational content.

Create a step-by-step tutorial script for: {topic}

Requirements:
- Duration: {duration} seconds
- Clear, concise instructions
- Beginner-friendly
- Include estimated time per step
- Suggest screen recording timestamps
- Add helpful tips and common mistakes to avoid
- Structure: Intro → Requirements → Steps (clearly numbered) → Conclusion → Resources

Format as valid JSON:
{
  "title": "Tutorial title",
  "difficulty_level": "beginner/intermediate/advanced",
  "estimated_total_time": "{duration} seconds",
  "intro": "Welcoming introduction",
  "requirements": ["Requirement 1", "Requirement 2"],
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "duration_seconds": 30,
      "voiceover": "Step instructions",
      "broll_suggestions": ["screen recording", "demo"],
      "tips": ["Helpful tip"],
      "common_mistakes": ["Mistake to avoid"]
    }
  ],
  "conclusion": "Summary and next steps",
  "resources_mentioned": ["Resource 1", "Resource 2"],
  "total_duration_seconds": {duration}
}`,
};

export function getPromptForFormat(
  format: VideoFormat,
  topic: string,
  duration: number,
  trendingAngle?: string
): string {
  const basePrompt = SCRIPT_PROMPTS[format];
  const minutes = Math.round(duration / 60);

  return basePrompt
    .replace('{topic}', topic)
    .replace('{duration}', duration.toString())
    .replace('{minutes}', minutes.toString())
    .replace('{trending_angle}', trendingAngle || 'viral, engaging, unique perspective');
}
