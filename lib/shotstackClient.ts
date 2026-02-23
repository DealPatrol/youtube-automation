const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_BASE_URL = 'https://api.shotstack.io/stage';

if (!SHOTSTACK_API_KEY) {
  console.warn('SHOTSTACK_API_KEY not set - video rendering disabled');
}

export async function shotstackRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!SHOTSTACK_API_KEY) {
    throw new Error('SHOTSTACK_API_KEY not configured');
  }

  const res = await fetch(`${SHOTSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      'x-api-key': SHOTSTACK_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Shotstack error:', res.status, text);
    throw new Error(`Shotstack error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
