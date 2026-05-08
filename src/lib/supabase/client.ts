import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  client.auth.onAuthStateChange((event: string) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      if (event === 'SIGNED_OUT' && typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  })

  return client
}
