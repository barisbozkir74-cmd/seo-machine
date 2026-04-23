import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service role client — Vault okuma için anon key değil service role key gerekir
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getDataForSeoCredentials(): Promise<{ login: string; password: string }> {
  // Önce env var fallback — Phase 1'de Vault kurulmamış olabilir (RESEARCH.md Pitfall 4)
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return {
      login: process.env.DATAFORSEO_LOGIN,
      password: process.env.DATAFORSEO_PASSWORD,
    }
  }

  // Supabase Vault'tan oku
  const { data, error } = await serviceClient
    .from('vault.decrypted_secrets')
    .select('name, decrypted_secret')
    .in('name', ['dataforseo_login', 'dataforseo_password'])

  if (error || !data?.length) {
    throw new Error(
      'DataForSEO credentials okunamadı. DATAFORSEO_LOGIN ve DATAFORSEO_PASSWORD env var olarak .env.local dosyasına ekleyin.'
    )
  }

  const loginRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === 'dataforseo_login')
  const passwordRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === 'dataforseo_password')

  if (!loginRow || !passwordRow) {
    throw new Error('DataForSEO credentials eksik.')
  }

  return { login: loginRow.decrypted_secret, password: passwordRow.decrypted_secret }
}
