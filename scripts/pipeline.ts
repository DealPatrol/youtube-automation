import 'dotenv/config'

import { createJob, listJobs, loadJob } from '@/lib/pipeline/job-store'
import { approveAndFinish, publishJob, rejectJob, runUntilApproval } from '@/lib/pipeline/run'
import { confirmDriveRights, importDriveShorts, runDriveAuthFlow } from '@/lib/pipeline/drive'
import { discoverTrends } from '@/lib/pipeline/trends'
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
 *   npm run pipeline -- drive-shorts [--query motivation] [--max 3]
 *   npm run pipeline -- confirm-rights <jobId>
 *   npm run pipeline -- status [jobId] | list | trends | auth | drive-auth
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
      const privacy = typeof flags.privacy === 'string' ? flags.privacy : undefined
      if (privacy && !['private', 'unlisted', 'public'].includes(privacy)) {
        throw new Error(`Invalid --privacy "${privacy}"`)
      }
      const job = await publishJob(jobId, privacy as 'private' | 'unlisted' | 'public' | undefined)
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
      const publish = Boolean(flags.publish)
      const rightsConfirmed = Boolean(flags['rights-confirmed'])
      const privacy =
        typeof flags.privacy === 'string' && ['private', 'unlisted', 'public'].includes(flags.privacy)
          ? (flags.privacy as PipelineConfig['privacy'])
          : 'private'
      const jobs = await importDriveShorts({
        query: typeof flags.query === 'string' ? flags.query : 'motivation',
        maxResults: Number(flags.max || 3),
        maxSeconds: Number(flags['max-seconds'] || 60),
        privacy,
        rightsConfirmed,
        publish,
      })
      for (const job of jobs) {
        printJobSummary(job)
      }
      if (publish && rightsConfirmed) {
        for (const job of jobs) {
          await confirmDriveRights(job.id)
          printJobSummary(await approveAndFinish(job.id))
        }
      } else if (publish) {
        console.log('\n[pipeline] Publish requested but Drive rights are not confirmed.')
        console.log('[pipeline] Review each job, then run:')
        for (const job of jobs) {
          console.log(`[pipeline]   npm run pipeline -- confirm-rights ${job.id}`)
          console.log(`[pipeline]   npm run pipeline -- approve ${job.id}`)
        }
      }
      break
    }
    case 'confirm-rights': {
      const jobId = positional[0]
      if (!jobId) throw new Error('Usage: pipeline confirm-rights <jobId>')
      printJobSummary(await confirmDriveRights(jobId))
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
  npm run pipeline -- drive-auth             one-time Google Drive read-only OAuth
  npm run pipeline -- drive-shorts [--query motivation] [--max 3]
                                             import Drive videos as private Shorts jobs
  npm run pipeline -- confirm-rights <jobId> confirm rights for Drive-sourced media

Flags on create:
  --topic     Skip trend discovery and use this topic
  --auto      Skip the human approval gate (renders + publishes immediately)
  --publish   Publish to YouTube after approval (default only with --auto)

Flags on drive-shorts:
  --query            Drive search text (default: motivation)
  --max              Number of Drive videos to import (default: 3)
  --max-seconds      Trim each Short to this many seconds (default: 60)
  --privacy          YouTube privacy if publishing (default: private)
  --publish          Publish after import/review
  --rights-confirmed Use only when you have confirmed ownership/license rights
`)
    }
  }
}

main().catch((error) => {
  console.error(`\n[pipeline] Failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
