import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

/**
 * Cache utilities for Redis
 */
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      return data as T | null
    } catch (error) {
      console.error('[v0] Redis get error:', error)
      return null
    }
  },

  async set<T>(key: string, value: T, exSeconds: number = 3600): Promise<void> {
    try {
      await redis.setex(key, exSeconds, JSON.stringify(value))
    } catch (error) {
      console.error('[v0] Redis set error:', error)
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('[v0] Redis del error:', error)
    }
  },

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const data = await redis.mget(...keys)
      return data as (T | null)[]
    } catch (error) {
      console.error('[v0] Redis mget error:', error)
      return keys.map(() => null)
    }
  },
}

/**
 * Job queue for long-running operations
 */
export const jobQueue = {
  async enqueue(jobId: string, jobData: any, priority: number = 0): Promise<void> {
    try {
      const key = `job:${jobId}`
      await redis.setex(key, 86400, JSON.stringify({
        ...jobData,
        status: 'queued',
        createdAt: Date.now(),
        priority,
      }))
      
      // Add to sorted set for priority queue
      await redis.zadd('job_queue', { score: priority, member: jobId })
      console.log('[v0] Job queued:', jobId)
    } catch (error) {
      console.error('[v0] Job queue error:', error)
    }
  },

  async getJob(jobId: string): Promise<any> {
    return cache.get(`job:${jobId}`)
  },

  async updateJob(jobId: string, updates: any): Promise<void> {
    const job = await this.getJob(jobId)
    if (job) {
      await cache.set(`job:${jobId}`, { ...job, ...updates }, 86400)
    }
  },

  async completeJob(jobId: string, result: any): Promise<void> {
    await this.updateJob(jobId, {
      status: 'completed',
      result,
      completedAt: Date.now(),
    })
  },

  async failJob(jobId: string, error: string): Promise<void> {
    await this.updateJob(jobId, {
      status: 'failed',
      error,
      failedAt: Date.now(),
    })
  },
}

/**
 * Rate limiting
 */
export const rateLimiter = {
  async checkLimit(key: string, limit: number = 10, windowSeconds: number = 60): Promise<boolean> {
    try {
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.expire(key, windowSeconds)
      }
      return count <= limit
    } catch (error) {
      console.error('[v0] Rate limiter error:', error)
      return true // Fail open
    }
  },
}
