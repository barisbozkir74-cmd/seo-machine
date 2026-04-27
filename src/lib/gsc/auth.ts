import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const GscTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(), // ms timestamp
  token_type: z.string().default('Bearer'),
})
export type GscTokens = z.infer<typeof GscTokensSchema>

export async function saveGscTokens(
  projectId: string,
  userId: string,
  tokens: GscTokens
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('projects')
    .update({ gsc_tokens: tokens })
    .eq('id', projectId)
    .eq('user_id', userId) // T-14-02: ownership garantisi — user_id tampering engellenir
}

export async function getValidGscToken(
  projectId: string,
  userId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('gsc_tokens')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project?.gsc_tokens) return null

  const parseResult = GscTokensSchema.safeParse(project.gsc_tokens)
  if (!parseResult.success) return null
  const tokens = parseResult.data

  // Token hala geçerli (5 dakika tolerans)
  if (tokens.expires_at > Date.now() + 5 * 60 * 1000) {
    return tokens.access_token
  }

  // Token süresi dolmuş — refresh
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const refreshed = await refreshRes.json()
  if (!refreshed.access_token) return null // refresh başarısız

  const newTokens: GscTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  }

  await saveGscTokens(projectId, userId, newTokens)
  return newTokens.access_token
}
