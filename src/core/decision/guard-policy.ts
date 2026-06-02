import 'server-only'

// Kritik karar tipleri — bu tiplerde guard ihlali kesinlikle bloklayıcıdır.
export const CRITICAL_DECISION_TYPES = ['architecture', 'strategy', 'brand'] as const
export type CriticalDecisionType = (typeof CRITICAL_DECISION_TYPES)[number]

// Fail-close endpoint'ler — guard throw veya violation durumunda üretimi bloklar.
// Wave F: content/generate | Wave G: keywords/strategy, ai/qa-audit
// Wave H: keywords/expand, ai/generate-page-package
export const FAIL_CLOSE_ENDPOINTS = [
  'content/generate',
  'keywords/strategy',
  'ai/qa-audit',
  'keywords/expand',
  'ai/generate-page-package',
] as const
export type FailCloseEndpoint = (typeof FAIL_CLOSE_ENDPOINTS)[number]

export function shouldFailClose(endpoint: string): boolean {
  return (FAIL_CLOSE_ENDPOINTS as readonly string[]).some(e => endpoint.includes(e))
}

export type GuardFailureContext = {
  decisionType?: string
  conflictCount?: number
  timestamp?: string
}

// Guard crash/timeout → structured log; çağıran katman audit trail'e de yazabilir.
// Format: [GUARD_FAILURE] endpoint=<path> decision_type=<type> conflict_count=<n> <message>
export function logGuardFailure(endpoint: string, error: unknown, context?: GuardFailureContext): void {
  const decisionType   = context?.decisionType   ?? '-'
  const conflictCount  = context?.conflictCount  ?? 0
  const timestamp      = context?.timestamp      ?? new Date().toISOString()
  console.error(
    `[GUARD_FAILURE] endpoint=${endpoint} decision_type=${decisionType} conflict_count=${conflictCount} ts=${timestamp}: ${error instanceof Error ? error.message : String(error)}`
  )
}
