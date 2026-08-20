import 'dotenv/config'

import { createJob, listJobs, loadJob } from '@/lib/pipeline/job-store'
import { approveAndFinish, publishJob, rejectJob, runUntilApproval } from '@/lib/pipeline/run'
import { discoverTrends } from '@/lib/pipeline/trends'
import { importDriveShorts, runDriveAuthFlow } from '@/lib/pipeline/drive-shorts'
import { runAuthFlow } from '@/lib/pipeline/youtube'
import type { PipelineConfig } from '@/lib/pipeline/types'
import { resolveContentPlatform } from '@/lib/content/generation'

/**
 * Content pipeline CLI.
 *
 *   npm run pipeline -- create [--topic "..."] [--minutes 1] [--aspect 9:16]
 *                              [--tone energetic] [--privacy unlisted]
 *                              [--auto] [--publish]
 *   npm run pipeline -- approve <jobId>
 *   npm run pipeline -- reject <jobId> --reason "..."
 *   npm run pipeline -- publish <jobId> [--privacy public]
 *   npm run pipeline -- status [jobId] | list | trends | auth | drive-auth
 *   npm run pipeline -- drive-shorts --query motivation --max 5 [--publish --rights-confirmed]
 */

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

function buildConfig(flags: Record<string, string | boolean>): PipelineConfig {
  const privacy = String(flags.privacy || 'unlisted')
  if (!['private', 'unlisted', 'public'].includes(privacy)) {
    throw new Error(`Invalid --privacy "${privacy}" (use private | unlisted | public)`)
  }
  const aspect = String(flags.aspect || '16:9')
  if (!['16:9', '9:16'].includes(aspect)) {
    throw new Error(`Invalid --aspect "${aspect}" (use 16:9 | 9:16)`)
  }
  return {
    topic: typeof flags.topic === 'string' ? flags.topic : undefined,
    platform: resolveContentPlatform(flags.platform || 'youtube'),
    durationMinutes: Number(flags.minutes || 1),
    tone: String(flags.tone || 'energetic'),
    aspectRatio: aspect as PipelineConfig['aspectRatio'],
    privacy: privacy as PipelineConfig['privacy'],
    autoApprove: Boolean(flags.auto),
    publishAfterRender: Boolean(flags.publish) || Boolean(flags.auto),
  }
}

function resolvePrivacy(value: unknown, fallback: PipelineConfig['privacy']): PipelineConfig['privacy'] {
  const privacy = typeof value === 'string' ? value : fallback
  if (!['private', 'unlisted', 'public'].includes(privacy)) {
    throw new Error(`Invalid --privacy "${privacy}" (use private | unlisted | public)`)
  }
  return privacy as PipelineConfig['privacy']
}

function printJobSummary(job: Awaited<ReturnType<typeof loadJob>>): void {
  console.log(`\n${job.id}  [${job.status}]`)
  console.log(`  topic:    ${job.trends?.selected.topic || job.config.topic || '(pending)'}`)
  if (job.content) console.log(`  title:    ${job.content.seo.title}`)
  if (job.approval?.reviewFile) console.log(`  review:   ${job.approval.reviewFile}`)
  if (job.render) console.log(`  video:    ${job.render.videoFile} (${job.render.durationSeconds.toFixed(1)}s)`)
  if (job.rights) console.log(`  rights:   ${job.rights.manifestFile} (${job.rights.assetCount} assets)`)
  if (job.publish) console.log(`  youtube:  ${job.publish.url} (${job.publish.privacy})`)
  if (job.error) console.log(`  error:    ${job.error}`)
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, flags } = parseArgs(rest)

  switch (command) {
    case 'create': {
      const config = buildConfig(flags)
      const job = await createJob(config)
      console.log(`[pipeline] Created job ${job.id}`)
      const finished = await runUntilApproval(job)
      printJobSummary(finished)
      break
    }
    case 'approve': {
      const jobId = positional[0]
      if (!jobId) throw new Error('Usage: pipeline approve <jobId>')
      const job = await approveAndFinish(jobId)
      printJobSummary(job)
      break
    }
    case 'reject': {
      const jobId = positional[0]
      if (!jobId) throw new Error('Usage: pipeline reject <jobId> [--reason "..."]')
      const job = await rejectJob(jobId, typeof flags.reason === 'string' ? flags.reason : undefined)
      printJobSummary(job)
      break
    }
    case 'publish': {
      const jobId = positional[0]
      if (!jobId) throw new Error('Usage: pipeline publish <jobId> [--privacy public]')
      const privacy = typeof flags.privacy === 'string' ? resolvePrivacy(flags.privacy, 'unlisted') : undefined
      const job = await publishJob(jobId, privacy)
      printJobSummary(job)
      break
    }
    case 'resume': {
      const jobId = positional[0]
      if (!jobId) throw new Error('Usage: pipeline resume <jobId>')
      const job = await loadJob(jobId)
      if (['approved', 'rendering', 'rendered', 'publishing', 'error'].includes(job.status) && job.approval?.approvedAt) {
        printJobSummary(await approveAndFinish(jobId))
      } else {
        printJobSummary(await runUntilApproval(job))
      }
      break
    }
    case 'status': {
      const jobId = positional[0]
      if (jobId) {
        printJobSummary(await loadJob(jobId))
      } else {
        const jobs = await listJobs()
        if (jobs.length === 0) console.log('No jobs yet. Start one with: npm run pipeline -- create')
        for (const job of jobs.slice(0, 10)) printJobSummary(job)
      }
      break
    }
    case 'list': {
      const jobs = await listJobs()
      if (jobs.length === 0) console.log('No jobs yet. Start one with: npm run pipeline -- create')
      for (const job of jobs) {
        console.log(`${job.id}  [${job.status}]  ${job.content?.seo.title || job.config.topic || ''}`)
      }
      break
    }
    case 'trends': {
      const candidates = await discoverTrends()
      console.log('\nTop trend candidates:\n')
      for (const candidate of candidates.slice(0, 15)) {
        console.log(
          `  ${String(candidate.score).padStart(3)}  [${candidate.source}]  ${candidate.topic}${
            candidate.detail ? `  (${candidate.detail})` : ''
          }`
        )
      }
      break
    }
    case 'auth': {
      await runAuthFlow()
      break
    }
    case 'drive-auth': {
      await runDriveAuthFlow()
      break
    }
    case 'drive-shorts': {
      const query = typeof flags.query === 'string' ? flags.query : 'motivation'
      const maxResults = Math.min(Math.max(Number(flags.max || 5), 1), 50)
      const results = await importDriveShorts({
        query,
        maxResults,
        privacy: resolvePrivacy(flags.privacy, 'private'),
        publish: Boolean(flags.publish),
        rightsConfirmed: Boolean(flags['rights-confirmed']),
        dryRun: Boolean(flags['dry-run']),
      })

      for (const result of results) {
        if (result.job) printJobSummary(result.job)
      }
      break
    }
    default: {
      console.log(`Content pipeline — trend discovery to YouTube publish.

Usage:
  npm run pipeline -- create [--topic "..."] [--minutes 1] [--aspect 16:9|9:16]
                             [--tone energetic] [--platform youtube]
                             [--privacy private|unlisted|public] [--auto] [--publish]
  npm run pipeline -- approve <jobId>        render + rights manifest + publish
  npm run pipeline -- reject <jobId> --reason "..."
  npm run pipeline -- publish <jobId> [--privacy public]
  npm run pipeline -- resume <jobId>         continue after a failure
  npm run pipeline -- status [jobId]
  npm run pipeline -- list
  npm run pipeline -- trends                 preview today's topic candidates
  npm run pipeline -- auth                   one-time YouTube OAuth (refresh token)
  npm run pipeline -- drive-auth             one-time read-only Google Drive OAuth
  npm run pipeline -- drive-shorts --query motivation --max 5
                                           import Drive videos as private Shorts jobs
  npm run pipeline -- drive-shorts --query motivation --max 5 --publish \\
                             --rights-confirmed --privacy private
                                           publish imported Drive shorts only after rights confirmation

Flags on create:
  --topic     Skip trend discovery and use this topic
  --auto      Skip the human approval gate (renders + publishes immediately)
  --publish   Publish to YouTube after approval (default only with --auto)
`)
    }
  }
}

main().catch((error) => {
  console.error(`\n[pipeline] Failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
