import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    env: {
      nextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      supabaseStorageBucket: Boolean(process.env.SUPABASE_STORAGE_BUCKET),
      openaiApiKey: Boolean(process.env.OPENAI_API_KEY),
      falKey: Boolean(process.env.FAL_KEY),
      videoAssemblyUrl: Boolean(process.env.VIDEO_ASSEMBLY_URL || process.env.FASTAPI_URL),
      xCredentials: Boolean(
        process.env.X_CONSUMER_KEY &&
          process.env.X_CONSUMER_SECRET &&
          process.env.X_ACCESS_TOKEN &&
          process.env.X_ACCESS_TOKEN_SECRET
      ),
    },
  })
}
