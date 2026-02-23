import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
  console.warn('OPENAI_API_KEY not set - script generation disabled');
}

export const openai = apiKey ? new OpenAI({ apiKey }) : (null as any);

export function validateOpenAIKey() {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
}
