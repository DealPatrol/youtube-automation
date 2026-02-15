import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { audioUrl, jobId } = await request.json()

    if (!audioUrl || !jobId) {
      return NextResponse.json(
        { error: 'audioUrl and jobId required' },
        { status: 400 }
      )
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim()

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log(`[Captions] Generating captions for job ${jobId}`)

    // Download audio file
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio file')
    }
    const audioBuffer = await audioResponse.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

    // Create FormData for Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')
    formData.append('language', 'en')

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const error = await whisperResponse.json()
      console.error('[Captions] Whisper API error:', error)
      throw new Error(error.error?.message || 'Whisper transcription failed')
    }

    const transcription = await whisperResponse.json()

    // Convert transcription to VTT format with timestamps
    const captionSegments = transcription.segments || []
    let vttContent = 'WEBVTT\n\n'

    for (const segment of captionSegments) {
      const startTime = formatTimestamp(segment.start)
      const endTime = formatTimestamp(segment.end)
      vttContent += `${startTime} --> ${endTime}\n${segment.text.trim()}\n\n`
    }

    // Also create SRT format
    let srtContent = ''
    let srtIndex = 1
    for (const segment of captionSegments) {
      const startTime = formatSrtTimestamp(segment.start)
      const endTime = formatSrtTimestamp(segment.end)
      srtContent += `${srtIndex}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n\n`
      srtIndex++
    }

    console.log(`[Captions] Generated ${captionSegments.length} caption segments for job ${jobId}`)

    return NextResponse.json({
      jobId,
      captionFormat: {
        vtt: vttContent,
        srt: srtContent,
      },
      segments: captionSegments,
      message: `Generated ${captionSegments.length} caption segments`,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Captions] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function formatSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
