'use client'

import { useState } from 'react'
import type { ImportedPageWithDepth } from '@/lib/wp/normalize'
import { AuditFlagBadge } from './AuditFlagBadge'
import { AuditFlagChips } from './AuditFlagChips'
import { cn } from '@/lib/utils'

type FlagKey = 'flag_orphan' | 'flag_weak_page' | 'flag_outdated' | 'flag_missing_metadata' | 'flag_missing_keyword' | 'flag_duplicate_intent'
const ALL_FLAGS: FlagKey[] = [
  'flag_orphan',
  'flag_weak_page',
  'flag_outdated',
  'flag_missing_metadata',
  'flag_missing_keyword',
  'flag_duplicate_intent',
]

interface ImportedPageTreeProps {
  pages: ImportedPageWithDepth[]
  importStatus?: string | null
}

export function ImportedPageTree({ pages, importStatus }: ImportedPageTreeProps) {
  const [activeFlags, setActiveFlags] = useState<Set<FlagKey>>(new Set())

  function toggleFlag(flag: FlagKey) {
    setActiveFlags(prev => {
      const next = new Set(prev)
      if (next.has(flag)) next.delete(flag)
      else next.add(flag)
      return next
    })
  }

  // OR mantığı: herhangi bir aktif flag'i taşıyan sayfalar gösterilir
  const filtered = activeFlags.size === 0
    ? pages
    : pages.filter(page =>
        [...activeFlags].some(flag => Boolean(page[flag as keyof typeof page]))
      )

  return (
    <div>
      <AuditFlagChips
        activeFlags={activeFlags}
        onToggle={toggleFlag}
        onClearAll={() => setActiveFlags(new Set())}
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Bu filtrelere uyan sayfa bulunamadı.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-0 bg-muted/50 border-b border-border text-xs text-muted-foreground font-normal">
            <div className="px-4 py-2">Sayfa</div>
            <div className="px-4 py-2">URL</div>
            <div className="px-4 py-2 min-w-[180px]">Durum</div>
            <div className="px-4 py-2 w-20 text-right">Tıklama</div>
            <div className="px-4 py-2 w-20 text-right">Pozisyon</div>
            <div className="px-4 py-2 w-32">İndeks</div>
            <div className="px-4 py-2 w-8"></div>
          </div>

          {/* Rows */}
          {filtered.map(page => (
            <div
              key={page.wp_id}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-0 border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors"
            >
              {/* Başlık — depth indent + ↳ */}
              <div
                className="px-4 py-2 truncate flex items-center"
                style={{ paddingLeft: `${16 + page.depth * 20}px` }}
              >
                {page.depth > 0 && (
                  <span className="text-muted-foreground mr-1.5">↳</span>
                )}
                <span className="truncate font-normal">{page.title}</span>
              </div>

              {/* URL */}
              <div className="px-4 py-2 truncate">
                {page.link ? (
                  <a
                    href={page.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground truncate block"
                  >
                    {page.slug || page.link}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Audit flag badge'leri */}
              <div className="px-4 py-2 flex items-center gap-1 flex-wrap min-w-[180px]">
                {ALL_FLAGS.map(flag =>
                  page[flag as keyof typeof page] ? (
                    <AuditFlagBadge key={flag} flag={flag} />
                  ) : null
                )}
                {page.primary_intent === null && page.content_summary === null && importStatus === 'enriching' && (
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-sm">
                    Analiz ediliyor...
                  </span>
                )}
              </div>

              {/* GSC tıklama */}
              <div className="px-4 py-2 w-20 text-right">
                <span
                  className={cn(
                    'text-xs',
                    page.gsc_clicks !== null ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  aria-label={page.gsc_clicks === null ? 'GSC verisi yok' : undefined}
                >
                  {page.gsc_clicks !== null ? page.gsc_clicks.toLocaleString('tr-TR') : '—'}
                </span>
              </div>

              {/* GSC pozisyon */}
              <div className="px-4 py-2 w-20 text-right">
                <span
                  className={cn(
                    'text-xs',
                    page.gsc_avg_position !== null ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  aria-label={page.gsc_avg_position === null ? 'GSC verisi yok' : undefined}
                >
                  {page.gsc_avg_position !== null
                    ? Number(page.gsc_avg_position).toFixed(1)
                    : '—'}
                </span>
              </div>

              {/* GSC index status */}
              <div className="px-4 py-2 w-32">
                {page.gsc_index_status === 'indexed' ? (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-emerald-900/40 text-emerald-400">
                    GSC&apos;de Görünüyor
                  </span>
                ) : (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                    Bilinmiyor
                  </span>
                )}
              </div>

              {/* Boş aksiyon alanı */}
              <div className="px-4 py-2 w-8"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
