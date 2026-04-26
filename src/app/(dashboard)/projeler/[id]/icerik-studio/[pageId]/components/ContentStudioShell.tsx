'use client'
// TODO: Plan 12-05 — tam implementasyon
export type { ContentStudioShellProps }
type ContentStudioShellProps = {
  projectId: string
  pageId: string
  pageTitle: string
  pkg: unknown
  resolvedRules: Record<string, boolean>
}
export function ContentStudioShell(_props: ContentStudioShellProps) {
  return <div className="p-8 text-sm text-muted-foreground">İçerik Stüdyosu yükleniyor...</div>
}
