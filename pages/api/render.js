// pages/api/render.js
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { assets, params } = req.body;
  const jobId = uuid();
  const job = { jobId, assets, params, createdAt: Date.now() };
  await redis.lpush('render:queue', JSON.stringify(job));
  await redis.hset(`job:${jobId}`, 'status', 'queued');
  return res.status(202).json({ jobId });
}
