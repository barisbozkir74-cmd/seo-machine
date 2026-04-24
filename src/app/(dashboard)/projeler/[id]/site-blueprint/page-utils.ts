export const INTENT_TO_PAGE_TYPE: Record<string, string> = {
  transactional: 'hizmet',
  commercial: 'hizmet',
  informational: 'blog',
  navigational: 'ana-sayfa',
}

export function intentToPageType(intent: string | null | undefined): string {
  if (!intent) return 'blog'
  const key = intent.toLowerCase().trim()
  return INTENT_TO_PAGE_TYPE[key] ?? 'blog'
}
