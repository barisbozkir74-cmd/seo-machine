import 'server-only'

// Kritik karar tipleri — bu tiplerde guard ihlali kesinlikle bloklayıcıdır.
// Wave F: content/generate bu tipleri ihlal ederse fail-close uygular.
export const CRITICAL_DECISION_TYPES = ['architecture', 'strategy', 'brand'] as const
export type CriticalDecisionType = (typeof CRITICAL_DECISION_TYPES)[number]

// Guard başarısız olduğunda (crash, timeout, vs.) konsola yazar.
// Çağıran katman bu bilgiyi audit trail'e yazabilir.
export function logGuardFailure(endpoint: string, error: unknown): void {
  console.error(
    `[GUARD_FAILURE] ${endpoint}: ${error instanceof Error ? error.message : String(error)}`
  )
}
