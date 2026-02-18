import { Redis } from '@upstash/redis'

let redisClient: Redis | null = null
let redisInitialized = false
let redisError: string | null = null

function initializeRedis(): Redis | null {
  if (redisInitialized) {
    if (redisError) {
      return null
    }
    return redisClient
  }

  redisInitialized = true

  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    redisError = 'Redis configuration missing: KV_REST_API_URL and/or KV_REST_API_TOKEN not set'
    console.warn('[v0] ' + redisError)
    return null
  }

  try {
    redisClient = new Redis({ url, token })
    return redisClient
  } catch (error) {
    redisError = error instanceof Error ? error.message : 'Failed to initialize Redis client'
    console.error('[v0] Redis initialization error:', redisError)
    return null
  }
}

export function getRedis(): Redis | null {
  return initializeRedis()
}

export const redis = {
  get client(): Redis | null {
    return getRedis()
  },
}

/**
 * Cache utilities for Redis
 */
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis()
    if (!client) {
      console.warn('[v0] Redis not configured, cannot get key:', key)
      return null
    }

    try {
      const data = await client.get(key)
      return data as T | null
    } catch (error) {
      console.error('[v0] Redis get error:', error)
      return null
    }
  },

  async set<T>(key: string, value: T, exSeconds: number = 3600): Promise<void> {
    const client = getRedis()
    if (!client) {
      console.warn('[v0] Redis not configured, cannot set key:', key)
      return
    }

    try {
      await client.setex(key, exSeconds, JSON.stringify(value))
    } catch (error) {
      console.error('[v0] Redis set error:', error)
    }
  },

  async del(key: string): Promise<void> {
    const client = getRedis()
    if (!client) {
      console.warn('[v0] Redis not configured, cannot delete key:', key)
      return
    }

    try {
      await client.del(key)
    } catch (error) {
      console.error('[v0] Redis del error:', error)
    }
  },

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const client = getRedis()
    if (!client) {
      console.warn('[v0] Redis not configured, cannot mget keys')
      return keys.map(() => null)
    }

    try {
      const data = await client.mget(...keys)
      return data as (T | null)[]
    } catch (error) {
      console.error('[v0] Redis mget error:', error)
      return keys.map(() => null)
    }
  },

  async zrange(key: string, start: number = 0, stop: number = -1): Promise<string[]> {
    try {
      const data = await redis.zrange(key, start, stop)
      return data as string[]
    } catch (error) {
      console.error('[v0] Redis zrange error:', error)
      return []
    }
  },

  async zrem(key: string, member: string): Promise<void> {
    try {
      await redis.zrem(key, member)
    } catch (error) {
      console.error('[v0] Redis zrem error:', error)
    }
  },
}

/**
 * Job queue for long-running operations
 */
export const jobQueue = {
  async enqueue(jobId: string, jobData: any, priority: number = 0): Promise<void> {
    const client = getRedis()
    if (!client) {
      console.warn('[v0] Redis not configured, cannot enqueue job:', jobId)
      return
    }

    try {
      const key = `job:${jobId}`
      await client.setex(key, 86400, JSON.stringify({
        ...jobData,
        status: 'queued',
        createdAt: Date.now(),
        priority,
      }))
      
      // Add to sorted set for priority queue
      await client.zadd('job_queue', { score: priority, member: jobId })
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
    const client = getRedis()
    if (!client) {
      console.warn('[v0] Redis not configured for rate limiting, allowing request')
      return true // Fail open - allow if Redis not configured
    }

    try {
      const count = await client.incr(key)
      if (count === 1) {
        await client.expire(key, windowSeconds)
      }
      return count <= limit
    } catch (error) {
      console.error('[v0] Rate limiter error:', error)
      return true // Fail open
    }
  },
}
