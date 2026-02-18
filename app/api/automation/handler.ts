import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { OpenAI } from 'openai'
import * as admin from 'firebase-admin'

// ---------- FIREBASE INIT ----------
let db: admin.firestore.Firestore | null = null
let firebaseInitError: string | null = null

try {
  if (!admin.apps.length) {
    const projectId = process.env.FB_PROJECT_ID
    const clientEmail = process.env.FB_CLIENT_EMAIL
    const privateKey = process.env.FB_PRIVATE_KEY

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        `Missing Firebase credentials. Required env vars: FB_PROJECT_ID (${!!projectId}), FB_CLIENT_EMAIL (${!!clientEmail}), FB_PRIVATE_KEY (${!!privateKey})`
      )
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    })
  }
  db = admin.firestore()
} catch (err) {
  firebaseInitError = err instanceof Error ? err.message : String(err)
  console.error('[INIT] Firebase initialization failed:', firebaseInitError)
}

// ---------- OPENAI INIT (SCRIPT GEN) ----------
let openai: OpenAI | null = null
let openaiInitError: string | null = null

try {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable')
  }
  openai = new OpenAI({ apiKey })
} catch (err) {
  openaiInitError = err instanceof Error ? err.message : String(err)
  console.error('[INIT] OpenAI initialization failed:', openaiInitError)
}

// ---------- YOUTUBE OAUTH INIT ----------
let youtubeInitError: string | null = null

function getYouTubeClient() {
  const clientId = process.env.YT_CLIENT_ID
  const clientSecret = process.env.YT_CLIENT_SECRET
  const redirectUri = process.env.YT_REDIRECT_URI
  const refreshToken = process.env.YT_REFRESH_TOKEN

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      `Missing YouTube OAuth credentials. Required env vars: YT_CLIENT_ID (${!!clientId}), YT_CLIENT_SECRET (${!!clientSecret}), YT_REDIRECT_URI (${!!redirectUri}), YT_REFRESH_TOKEN (${!!refreshToken})`
    )
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  return google.youtube({
    version: 'v3',
    auth: oauth2Client,
  })
}

// ---------- MAIN HANDLER ----------
export async function POST(request: NextRequest) {
  try {
    // Check initialization errors
    if (firebaseInitError) {
      console.error('[API] Firebase not initialized:', firebaseInitError)
      return NextResponse.json(
        { error: 'Firebase not configured', details: firebaseInitError },
        { status: 500 }
      )
    }

    if (openaiInitError) {
      console.error('[API] OpenAI not initialized:', openaiInitError)
      return NextResponse.json(
        { error: 'OpenAI not configured', details: openaiInitError },
        { status: 500 }
      )
    }

    if (!db) {
      console.error('[API] Database not available')
      return NextResponse.json(
        { error: 'Database not available', details: firebaseInitError || 'Unknown error' },
        { status: 500 }
      )
    }

    if (!openai) {
      console.error('[API] OpenAI client not available')
      return NextResponse.json(
        { error: 'OpenAI not available', details: openaiInitError || 'Unknown error' },
        { status: 500 }
      )
    }

    const { action } = await request.json()

    switch (action) {
      case 'generateScript':
        return await handleGenerateScript(request, db, openai)
      case 'generateVideo':
        return await handleGenerateVideo(request, db)
      case 'publishNow':
        return await handlePublishNow(request, db)
      case 'schedule':
        return await handleSchedule(request, db)
      case 'runDueSchedules':
        return await handleRunDueSchedules(request, db)
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[API] Automation error:', err)
    return NextResponse.json(
      { error: 'Internal error', details: err.message },
      { status: 500 }
    )
  }
}

// ---------- 1) SCRIPT GENERATION ----------
async function handleGenerateScript(
  request: NextRequest,
  db: admin.firestore.Firestore,
  openai: OpenAI
) {
  const body = await request.json()
  const { topic, tone = 'educational', length = 'short' } = body

  if (!topic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 })
  }

  const prompt = `
You are writing a YouTube short script.

Topic: ${topic}
Tone: ${tone}
Length: ${length} (aim for 45-60 seconds)
Format: Hook, value, CTA. Return plain text only.
`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  })

  const script = completion.choices[0]?.message?.content?.trim() || ''

  const docRef = await db.collection('jobs').add({
    topic,
    script,
    status: 'SCRIPT_CREATED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ jobId: docRef.id, script })
}

// ---------- 2) VIDEO GENERATION (CALL YOUR EXISTING APP) ----------
async function handleGenerateVideo(request: NextRequest, db: admin.firestore.Firestore) {
  const body = await request.json()
  const { jobId } = body

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
  }

  const jobSnap = await db.collection('jobs').doc(jobId).get()
  if (!jobSnap.exists) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const job = jobSnap.data() as any

  // Call your existing video creation app
  const videoApiUrl = process.env.VIDEO_APP_ENDPOINT
  if (!videoApiUrl) {
    return NextResponse.json({ error: 'VIDEO_APP_ENDPOINT not configured' }, { status: 500 })
  }

  const resp = await fetch(videoApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      script: job.script,
      topic: job.topic,
      jobId,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error('[API] Video app error:', text)
    return NextResponse.json(
      { error: 'Video app failed', details: text },
      { status: 500 }
    )
  }

  const data = await resp.json()
  const videoUrl = data.videoUrl

  await db.collection('jobs').doc(jobId).update({
    videoUrl,
    status: 'VIDEO_CREATED',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ jobId, videoUrl })
}

// ---------- 3) PUBLISH NOW TO YOUTUBE ----------
async function handlePublishNow(request: NextRequest, db: admin.firestore.Firestore) {
  const body = await request.json()
  const { jobId, title, description, privacyStatus = 'public' } = body

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
  }

  try {
    var youtube = getYouTubeClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[API] YouTube client initialization failed:', message)
    return NextResponse.json(
      { error: 'YouTube credentials not configured', details: message },
      { status: 500 }
    )
  }

  const jobSnap = await db.collection('jobs').doc(jobId).get()
  if (!jobSnap.exists) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const job = jobSnap.data() as any
  if (!job.videoUrl) {
    return NextResponse.json(
      { error: 'No videoUrl on job. Generate video first.' },
      { status: 400 }
    )
  }

  // Fetch video as buffer
  const videoResp = await fetch(job.videoUrl)
  if (!videoResp.ok) {
    const text = await videoResp.text()
    console.error('[API] Video download error:', text)
    return NextResponse.json({ error: 'Failed to download video' }, { status: 500 })
  }

  const buffer = await videoResp.arrayBuffer()

  const uploadResp = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: title || job.topic || 'Untitled Video',
        description: description || job.script || '',
      },
      status: {
        privacyStatus,
      },
    },
    media: {
      body: Buffer.from(buffer),
    },
  } as any)

  const videoId = uploadResp.data.id

  await db.collection('jobs').doc(jobId).update({
    status: 'PUBLISHED',
    youtubeVideoId: videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return NextResponse.json({
    jobId,
    youtubeVideoId: videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
  })
}

// ---------- 4) SCHEDULE A FUTURE PUBLISH ----------
async function handleSchedule(request: NextRequest, db: admin.firestore.Firestore) {
  const body = await request.json()
  const { jobId, runAt } = body

  if (!jobId || !runAt) {
    return NextResponse.json({ error: 'Missing jobId or runAt' }, { status: 400 })
  }

  const runAtDate = new Date(runAt)
  if (isNaN(runAtDate.getTime())) {
    return NextResponse.json({ error: 'Invalid runAt' }, { status: 400 })
  }

  await db.collection('schedules').add({
    jobId,
    runAt: admin.firestore.Timestamp.fromDate(runAtDate),
    status: 'PENDING',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ success: true })
}

// ---------- 5) CRON: RUN DUE SCHEDULES ----------
async function handleRunDueSchedules(request: NextRequest, db: admin.firestore.Firestore) {
  let youtube
  try {
    youtube = getYouTubeClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[API] YouTube client initialization failed:', message)
    return NextResponse.json(
      { error: 'YouTube credentials not configured', details: message },
      { status: 500 }
    )
  }

  const now = admin.firestore.Timestamp.now()

  const snap = await db
    .collection('schedules')
    .where('status', '==', 'PENDING')
    .where('runAt', '<=', now)
    .get()

  const results: any[] = []

  for (const doc of snap.docs) {
    const schedule = doc.data() as any
    const scheduleId = doc.id

    const jobSnap = await db.collection('jobs').doc(schedule.jobId).get()
    if (!jobSnap.exists) {
      await doc.ref.update({ status: 'FAILED', reason: 'Job not found' })
      continue
    }

    const job = jobSnap.data() as any
    if (!job.videoUrl) {
      await doc.ref.update({ status: 'FAILED', reason: 'No videoUrl on job' })
      continue
    }

    // Download video
    const videoResp = await fetch(job.videoUrl)
    if (!videoResp.ok) {
      await doc.ref.update({ status: 'FAILED', reason: 'Video download failed' })
      continue
    }

    const buffer = await videoResp.arrayBuffer()

    try {
      const uploadResp = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: job.topic || 'Untitled Video',
            description: job.script || '',
          },
          status: {
            privacyStatus: 'public',
          },
        },
        media: {
          body: Buffer.from(buffer),
        },
      } as any)

      const videoId = uploadResp.data.id

      await db.collection('jobs').doc(schedule.jobId).update({
        status: 'PUBLISHED',
        youtubeVideoId: videoId,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      await doc.ref.update({
        status: 'COMPLETED',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      results.push({ scheduleId, jobId: schedule.jobId, videoId })
    } catch (e: any) {
      console.error('[API] Scheduled publish error:', e.message)
      await doc.ref.update({ status: 'FAILED', reason: e.message })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
