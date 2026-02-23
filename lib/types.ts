export type Scene = {
  id: string;
  text: string;        // overlay text
  start: number;       // seconds
  length: number;      // seconds
  keywords: string[];  // for clip search
  clipUrl?: string;    // Pexels or other
};

export type RenderFormat = 'portrait' | 'landscape';

export type ShotstackRenderResponse = {
  id: string;
  status: string;
  url?: string;
};
