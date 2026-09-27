export function getRuntimeStatusEnv(
  env: Record<string, string | undefined> = process.env,
  localFfmpegAvailable = false
) {
  return {
    databaseUrl: Boolean(env.DATABASE_URL),
    betterAuthSecret: Boolean(env.BETTER_AUTH_SECRET),
    blobToken: Boolean(env.BLOB_READ_WRITE_TOKEN),
    openaiApiKey: Boolean(env.OPENAI_API_KEY),
    falKey: Boolean(env.FAL_KEY),
    videoAssemblyUrl: Boolean(
      env.VIDEO_ASSEMBLY_URL || env.FASTAPI_URL || localFfmpegAvailable
    ),
    youtubeOAuth: Boolean(
      env.YOUTUBE_CLIENT_ID &&
        env.YOUTUBE_CLIENT_SECRET &&
        (env.NEXTAUTH_URL || env.RENDER_EXTERNAL_URL || env.VERCEL_URL || env.BETTER_AUTH_URL)
    ),
    xCredentials: Boolean(
      env.X_CONSUMER_KEY &&
        env.X_CONSUMER_SECRET &&
        env.X_ACCESS_TOKEN &&
        env.X_ACCESS_TOKEN_SECRET
    ),
  }
}
