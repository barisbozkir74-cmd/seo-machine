import 'server-only'

// Kritik karar tipleri — bu tiplerde guard ihlali kesinlikle bloklayıcıdır.
export const CRITICAL_DECISION_TYPES = ['architecture', 'strategy', 'brand'] as const
export type CriticalDecisionType = (typeof CRITICAL_DECISION_TYPES)[number]

// Fail-close endpoint'ler — guard throw veya violation durumunda üretimi bloklar.
// Wave F: content/generate | Wave G: keywords/strategy, ai/qa-audit
export const FAIL_CLOSE_ENDPOINTS = [
  'content/generate',
  'keywords/strategy',
  'ai/qa-audit',
] as const
export type FailCloseEndpoint = (typeof FAIL_CLOSE_ENDPOINTS)[number]

export function shouldFailClose(endpoint: string): boolean {
  return (FAIL_CLOSE_ENDPOINTS as readonly string[]).some(e => endpoint.includes(e))
}

// Guard crash/timeout → konsola yazar; çağıran katman audit trail'e de yazabilir.
export function logGuardFailure(endpoint: string, error: unknown): void {
  console.error(
    `[GUARD_FAILURE] ${endpoint}: ${error instanceof Error ? error.message : String(error)}`
  )
}
