'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveProjectInfo } from './actions'

export function ApproveProjectInfoButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [missingFields, setMissingFields] = useState<{ key: string; label: string }[]>([])
  const [saved, setSaved] = useState(false)

  function handleApprove() {
    setMissingFields([])
    setSaved(false)
    startTransition(async () => {
      const result = await approveProjectInfo(projectId)
      if (!result.success) {
        setMissingFields(result.missingFields)
        return
      }
      setSaved(true)
      // 1.5 saniye sonra Ürünler/Hizmetler sayfasına geç
      setTimeout(() => router.push(result.redirectTo), 1500)
    })
  }

  return (
    <div className="mt-8 border-t border-border/30 pt-6">

      {/* Eksik alan uyarıları */}
      {missingFields.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <p className="text-[11px] font-medium text-amber-400/80 mb-2">
            Onaylamadan önce şu alanları doldurun:
          </p>
          <ul className="space-y-0.5">
            {missingFields.map(f => (
              <li key={f.key} className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
                <span className="h-1 w-1 rounded-full bg-amber-400/60 shrink-0" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Başarı mesajı */}
      {saved && (
        <div className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <p className="text-[11px] text-emerald-400/80">
            Proje bilgileri karar havuzuna kaydedildi. Ürünler / Hizmetler bölümüne geçiliyor…
          </p>
        </div>
      )}

      {/* Onayla butonu */}
      <button
        onClick={handleApprove}
        disabled={isPending || saved}
        className={[
          'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors border',
          saved
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400/70 cursor-default'
            : isPending
            ? 'border-border/30 bg-secondary/20 text-muted-foreground/50 cursor-default'
            : 'border-blue-500/30 bg-blue-500/10 text-blue-400/80 hover:bg-blue-500/15 hover:border-blue-500/40',
        ].join(' ')}
      >
        {saved ? (
          <>✓ Kaydedildi — yönlendiriliyor</>
        ) : isPending ? (
          <>Kontrol ediliyor…</>
        ) : (
          <>Proje Bilgilerini Onayla</>
        )}
      </button>

      <p className="text-[10px] text-muted-foreground/30 text-center mt-2">
        Onay, tüm zorunlu alanları kontrol eder ve karar havuzuna kaydeder.
      </p>
    </div>
  )
}
