export function getRuntimeStatusEnv(env: NodeJS.ProcessEnv = process.env) {
  return {
    nextPublicSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    nextPublicSupabaseAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseStorageBucket: Boolean(env.SUPABASE_STORAGE_BUCKET),
    openaiApiKey: Boolean(env.OPENAI_API_KEY),
    falKey: Boolean(env.FAL_KEY),
    videoAssemblyUrl: Boolean(env.VIDEO_ASSEMBLY_URL || env.FASTAPI_URL),
    youtubeOAuth: Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.NEXTAUTH_URL),
    xCredentials: Boolean(
      env.X_CONSUMER_KEY &&
        env.X_CONSUMER_SECRET &&
        env.X_ACCESS_TOKEN &&
        env.X_ACCESS_TOKEN_SECRET
    ),
  }
}
