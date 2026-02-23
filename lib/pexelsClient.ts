const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_BASE_URL = 'https://api.pexels.com/videos/search';

if (!PEXELS_API_KEY) {
  console.warn('PEXELS_API_KEY not set - stock footage search disabled');
}

export async function searchPexelsVideo(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY) {
    console.warn('Pexels API key not configured');
    return null;
  }

  const res = await fetch(`${PEXELS_BASE_URL}?query=${encodeURIComponent(query)}&per_page=1`, {
    headers: {
      Authorization: PEXELS_API_KEY,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error('Pexels error:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const video = data.videos?.[0];
  const file = video?.video_files?.find((f: any) => f.quality === 'hd') || video?.video_files?.[0];
  return file?.link || null;
}
