'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'

export function HtmlReadyBanner() {
  return (
    <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
      <HugeiconsIcon icon={Tick02Icon} className="text-emerald-400 shrink-0" size={20} />
      <div>
        <p className="text-sm font-semibold text-emerald-400">HTML Çıktısı Hazır</p>
        <p className="text-sm text-muted-foreground">
          Tüm bölümler onaylandı. İçerik WordPress&apos;e yayınlanmaya hazır.
        </p>
      </div>
    </div>
  )
}
