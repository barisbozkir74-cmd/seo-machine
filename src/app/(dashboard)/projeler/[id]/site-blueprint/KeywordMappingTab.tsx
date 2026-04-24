import { IntentBadge } from '../keyword-stratejisi/IntentBadge'

export type MappedPage = {
  id: string
  title: string
  focusKeyword: string | null
  clusterKeywords: string[]  // comma-list render için; cluster'ın tüm keyword'leri
  intent: string | null
  hasConflict: boolean
}

export type UnmappedKeyword = {
  id: string
  keyword: string
}

export function KeywordMappingTab({
  mappedPages,
  unmappedKeywords,
}: {
  mappedPages: MappedPage[]
  unmappedKeywords: UnmappedKeyword[]
}) {
  return (
    <div className="space-y-8">
      {/* Section A: Eşleşen Keyword'ler */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Eşleşen Keyword&apos;ler</h2>

        {mappedPages.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Sayfa oluşturulmamış. &ldquo;Kümelerden Oluştur&rdquo; ile başlayın.
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_2fr_7rem] gap-0 bg-muted/50 border-b border-border text-xs text-muted-foreground font-normal">
              <div className="px-4 py-2">Sayfa Adı</div>
              <div className="px-4 py-2">Odak Keyword</div>
              <div className="px-4 py-2">Küme Keyword&apos;leri</div>
              <div className="px-4 py-2">Intent</div>
            </div>
            {mappedPages.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_1fr_2fr_7rem] gap-0 border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="px-4 py-2 font-normal truncate flex items-center">
                  {p.title}
                  {p.hasConflict && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
                      ⚠ Çakışma
                    </span>
                  )}
                </div>
                <div className="px-4 py-2 text-sm text-muted-foreground truncate">
                  {p.focusKeyword ?? '—'}
                </div>
                <div className="px-4 py-2 text-xs text-muted-foreground truncate">
                  {p.clusterKeywords.join(', ')}
                </div>
                <div className="px-4 py-2">
                  <IntentBadge intent={p.intent} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section B: Eşleşmeyenler */}
      {unmappedKeywords.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-400">
            Eşleşmeyen Keyword&apos;ler ({unmappedKeywords.length})
          </h2>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            Bu keyword&apos;ler henüz bir sayfaya bağlı değil. Küme oluşturup
            &ldquo;Kümelerden Oluştur&rdquo; ile sayfa atayın.
          </div>

          <ul className="space-y-1">
            {unmappedKeywords.map((k) => (
              <li key={k.id} className="text-sm text-muted-foreground py-1">
                {k.keyword}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
