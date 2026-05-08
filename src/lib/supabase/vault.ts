import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service role client — Vault için anon key değil service role key gerekir
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getDataForSeoCredentials(): Promise<{ login: string; password: string }> {
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return {
      login: process.env.DATAFORSEO_LOGIN,
      password: process.env.DATAFORSEO_PASSWORD,
    }
  }

  const { data, error } = await serviceClient
    .rpc('vault_get_secrets', { p_names: ['dataforseo_login', 'dataforseo_password'] })

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

// wp credentials'ı Vault'a kaydeder (upsert: varsa sil+yeniden oluştur)
// SECURITY: appPassword hiçbir zaman loglanmaz
export async function saveWpCredentials(
  projectId: string,
  wpUrl: string,
  appPassword: string,
  username: string
): Promise<void> {
  const urlKey = `wp_url_${projectId}`
  const passKey = `wp_app_password_${projectId}`
  const userKey = `wp_username_${projectId}`

  async function upsertSecret(keyName: string, value: string): Promise<void> {
    const { data: rows } = await serviceClient
      .rpc('vault_find_secret_id', { p_name: keyName })

    const existingId = rows?.[0]?.id ?? null

    if (existingId) {
      const { error: delError } = await serviceClient
        .rpc('vault_delete_secret', { p_id: existingId })
      if (delError) throw new Error(`Vault silinemedi: ${keyName} — ${delError.message}`)
    }

    const { error: createError } = await serviceClient
      .rpc('vault_create_secret', { p_name: keyName, p_secret: value })
    if (createError) throw new Error(`Vault'a yazılamadı: ${keyName} — ${createError.message}`)
  }

  await upsertSecret(urlKey, wpUrl)
  await upsertSecret(passKey, appPassword) // appPassword loglanmaz
  await upsertSecret(userKey, username)
}

// wp credentials'ı Vault'tan okur
export async function getWordPressCredentials(
  projectId: string
): Promise<{ wpUrl: string; appPassword: string; username: string } | null> {
  const urlKey = `wp_url_${projectId}`
  const passKey = `wp_app_password_${projectId}`
  const userKey = `wp_username_${projectId}`

  const { data, error } = await serviceClient
    .rpc('vault_get_secrets', { p_names: [urlKey, passKey, userKey] })

  if (error || !data?.length) return null

  const urlRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === urlKey)
  const passRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === passKey)
  const userRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === userKey)
  if (!urlRow || !passRow) return null

  return {
    wpUrl: urlRow.decrypted_secret,
    appPassword: passRow.decrypted_secret,
    username: userRow?.decrypted_secret ?? 'admin',
  }
}

// WP key'leri Vault'ta mevcutsa true döner
export async function hasWordPressCredentials(projectId: string): Promise<boolean> {
  const creds = await getWordPressCredentials(projectId)
  return creds !== null
}

// SerpAPI anahtarını döner — env var önce, vault fallback
// SECURITY: key asla loglanmaz; dosya import 'server-only' ile korunur (T-18-01, T-18-02)
export async function getSerpApiKey(): Promise<string> {
  if (process.env.SERPAPI_KEY) return process.env.SERPAPI_KEY

  const { data, error } = await serviceClient
    .from('vault.decrypted_secrets')
    .select('name, decrypted_secret')
    .in('name', ['serpapi_key'])

  if (error || !data?.length) {
    throw new Error('SERPAPI_KEY env var olarak .env.local dosyasına ekleyin.')
  }

  const row = data.find((s: { name: string; decrypted_secret: string }) => s.name === 'serpapi_key')
  if (!row) throw new Error('SerpAPI key bulunamadı.')
  return row.decrypted_secret
}
