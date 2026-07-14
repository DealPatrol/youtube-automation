import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

import type { PipelineConfig, PipelineJob } from './types'

export function jobsRoot(): string {
  return process.env.PIPELINE_JOBS_DIR || path.join(process.cwd(), 'content', 'jobs')
}

export function jobDir(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safeId) throw new Error('Invalid job id')
  return path.join(jobsRoot(), safeId)
}

function jobFile(jobId: string): string {
  return path.join(jobDir(jobId), 'job.json')
}

export async function createJob(config: PipelineConfig): Promise<PipelineJob> {
  const id = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()
  const job: PipelineJob = {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'created',
    config,
    rightsRecords: [],
  }
  await fs.promises.mkdir(jobDir(id), { recursive: true })
  await saveJob(job)
  return job
}

export async function saveJob(job: PipelineJob): Promise<PipelineJob> {
  job.updatedAt = new Date().toISOString()
  const file = jobFile(job.id)
  await fs.promises.mkdir(path.dirname(file), { recursive: true })
  const tmpFile = `${file}.tmp`
  await fs.promises.writeFile(tmpFile, JSON.stringify(job, null, 2))
  await fs.promises.rename(tmpFile, file)
  return job
}

export async function loadJob(jobId: string): Promise<PipelineJob> {
  const file = jobFile(jobId)
  if (!fs.existsSync(file)) {
    throw new Error(`Job not found: ${jobId} (looked in ${file})`)
  }
  const raw = await fs.promises.readFile(file, 'utf8')
  return JSON.parse(raw) as PipelineJob
}

export async function listJobs(): Promise<PipelineJob[]> {
  const root = jobsRoot()
  if (!fs.existsSync(root)) return []
  const entries = await fs.promises.readdir(root, { withFileTypes: true })
  const jobs: PipelineJob[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      jobs.push(await loadJob(entry.name))
    } catch {
      // Skip directories without a valid job.json
    }
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Resolve a path inside the job directory, creating parent folders as needed. */
export async function jobPath(jobId: string, ...segments: string[]): Promise<string> {
  const target = path.join(jobDir(jobId), ...segments)
  await fs.promises.mkdir(path.dirname(target), { recursive: true })
  return target
}

/** Convert an absolute path inside the job dir to a job-relative path for manifests. */
export function relativeToJob(jobId: string, absolutePath: string): string {
  return path.relative(jobDir(jobId), absolutePath)
}
