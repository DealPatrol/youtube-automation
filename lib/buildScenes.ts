import { Scene } from './types';

export function buildScenesFromAI(
  aiScenes: { overlay_text: string; keywords: string[]; length: number; clipUrl?: string }[]
): Scene[] {
  let currentStart = 0;

  return aiScenes.map((s, index) => {
    const length = Math.max(3, Math.min(10, s.length || 5));

    const scene: Scene = {
      id: `scene-${index}`,
      text: s.overlay_text,
      start: currentStart,
      length,
      keywords: s.keywords || [],
      clipUrl: s.clipUrl,
    };

    currentStart += length;
    return scene;
  });
}
