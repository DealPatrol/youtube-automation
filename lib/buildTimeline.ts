import { Scene, RenderFormat } from './types';

type ShotstackClip = {
  asset: any;
  start: number;
  length: number;
  effect?: string;
  transition?: { in?: string; out?: string };
  position?: string;
  offset?: { x?: number; y?: number };
};

type ShotstackEdit = {
  timeline: {
    soundtracks?: { src: string; effect?: string }[];
    tracks: { clips: ShotstackClip[] }[];
  };
  output: {
    format: 'mp4';
    resolution: 'hd' | 'portrait';
    fps: number;
  };
};

function buildShotstackEdit(
  scenes: Scene[],
  audioUrl: string | null,
  format: RenderFormat
): ShotstackEdit {
  const resolution = format === 'portrait' ? 'portrait' : 'hd';

  const videoClips: ShotstackClip[] = [];
  const textClips: ShotstackClip[] = [];

  for (const scene of scenes) {
    if (scene.clipUrl) {
      videoClips.push({
        asset: {
          type: 'video',
          src: scene.clipUrl,
          volume: 0,
          trim: 0,
        },
        start: scene.start,
        length: scene.length,
        transition: { in: 'fade', out: 'fade' },
      });
    }

    textClips.push({
      asset: {
        type: 'title',
        text: scene.text,
        style: 'minimal',
        size: 'medium',
        color: '#FFFFFF',
        background: 'rgba(0,0,0,0.4)',
      },
      start: scene.start + 0.2,
      length: scene.length - 0.4,
      position: 'center',
    });
  }

  const tracks: { clips: ShotstackClip[] }[] = [
    { clips: videoClips },
    { clips: textClips },
  ];

  const soundtracks =
    audioUrl && audioUrl.startsWith('http')
      ? [{ src: audioUrl, effect: 'fadeInFadeOut' }]
      : undefined;

  return {
    timeline: {
      soundtracks,
      tracks,
    },
    output: {
      format: 'mp4',
      resolution,
      fps: 30,
    },
  };
}

export function buildDualTimelines(
  scenes: Scene[],
  audioUrl: string | null
): { portrait: ShotstackEdit; landscape: ShotstackEdit } {
  return {
    portrait: buildShotstackEdit(scenes, audioUrl, 'portrait'),
    landscape: buildShotstackEdit(scenes, audioUrl, 'landscape'),
  };
}
