import 'server-only'
import { createClient } from '@supabase/supabase-js'

// This module MUST only be imported in Server Components, Server Actions, or Route Handlers.
// It will throw at build time if imported in a Client Component.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type SecretName = 'DATAFORSEO_API_KEY' | 'SEMRUSH_API_KEY' | 'OPENAI_API_KEY'

/**
 * Retrieve an API key from Supabase Vault.
 * Must only be called from server-side code (Server Actions, Route Handlers, Edge Functions).
 * Never expose the return value to the client.
 *
 * Keys must be inserted into Vault manually via Supabase Dashboard or CLI:
 *   SELECT vault.create_secret('your-key-value', 'DATAFORSEO_API_KEY');
 */
export async function getVaultSecret(name: SecretName): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('vault.decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', name)
    .single()

  if (error || !data) {
    throw new Error(`Vault secret '${name}' not found or access denied: ${error?.message}`)
  }

  return data.decrypted_secret
}
