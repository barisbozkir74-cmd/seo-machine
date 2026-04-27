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

// wp_url ve wp_app_password'u Vault'a kaydeder (upsert: varsa güncelle, yoksa oluştur)
// SECURITY: appPassword hiçbir zaman loglanmaz
export async function saveWpCredentials(
  projectId: string,
  wpUrl: string,
  appPassword: string
): Promise<void> {
  const urlKey = `wp_url_${projectId}`
  const passKey = `wp_app_password_${projectId}`

  // Her iki key için upsert: önce mevcut secret ID'yi ara
  async function upsertSecret(keyName: string, value: string): Promise<void> {
    const { data: existing } = await serviceClient
      .from('vault.secrets')
      .select('id')
      .eq('name', keyName)
      .maybeSingle()

    if (existing?.id) {
      // CR-03: vault.update_secret may fail if vault schema not on search_path;
      // delete-then-create is schema-agnostic and always reliable.
      await serviceClient.from('vault.secrets').delete().eq('id', existing.id)
      const { error } = await serviceClient.rpc('vault.create_secret', {
        secret: value,
        name: keyName,
      })
      if (error) throw new Error(`Vault güncellenemedi: ${keyName}`)
    } else {
      const { error } = await serviceClient.rpc('vault.create_secret', {
        secret: value,
        name: keyName,
      })
      if (error) throw new Error(`Vault'a yazılamadı: ${keyName}`)
    }
  }

  await upsertSecret(urlKey, wpUrl)
  await upsertSecret(passKey, appPassword) // appPassword loglanmaz
}

// wp_url ve wp_app_password'u Vault'tan okur
// Her iki key de mevcutsa { wpUrl, appPassword } döner; biri eksikse null döner
export async function getWordPressCredentials(
  projectId: string
): Promise<{ wpUrl: string; appPassword: string } | null> {
  const urlKey = `wp_url_${projectId}`
  const passKey = `wp_app_password_${projectId}`

  const { data, error } = await serviceClient
    .from('vault.decrypted_secrets')
    .select('name, decrypted_secret')
    .in('name', [urlKey, passKey])

  if (error || !data?.length) return null

  const urlRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === urlKey)
  const passRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === passKey)
  if (!urlRow || !passRow) return null

  return { wpUrl: urlRow.decrypted_secret, appPassword: passRow.decrypted_secret }
}

// Her iki WP key de Vault'ta mevcutsa true döner (bağlantı durumu badge'i için)
export async function hasWordPressCredentials(projectId: string): Promise<boolean> {
  const creds = await getWordPressCredentials(projectId)
  return creds !== null
}
