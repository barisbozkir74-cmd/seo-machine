'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addBusinessEntity, deleteBusinessEntity } from '@/app/(dashboard)/projeler/[id]/isletme/actions'
import type { BusinessEntity } from '@/app/(dashboard)/projeler/[id]/isletme/actions'

// ─── Türkiye 81 İl listesi ────────────────────────────────────────────────────
const TR_PROVINCES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
  'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
  'Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum',
  'Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin',
  'İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
  'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak',
  'Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan',
  'Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
]

// ─── Bölge grupları ───────────────────────────────────────────────────────────
const REGION_SHORTCUTS = [
  { label: 'Marmara',          iller: ['İstanbul','Bursa','Kocaeli','Tekirdağ','Edirne','Kırklareli','Balıkesir','Çanakkale','Bilecik','Yalova','Sakarya'] },
  { label: 'Ege',              iller: ['İzmir','Aydın','Denizli','Manisa','Muğla','Kütahya','Afyonkarahisar','Uşak'] },
  { label: 'Akdeniz',         iller: ['Antalya','Adana','Mersin','Hatay','Burdur','Isparta','Kahramanmaraş','Osmaniye'] },
  { label: 'İç Anadolu',      iller: ['Ankara','Konya','Kayseri','Sivas','Eskişehir','Aksaray','Karaman','Kırıkkale','Niğde','Nevşehir','Kırşehir','Çankırı','Yozgat'] },
  { label: 'Karadeniz',       iller: ['Trabzon','Samsun','Ordu','Rize','Giresun','Zonguldak','Bartın','Karabük','Kastamonu','Sinop','Tokat','Amasya','Çorum','Gümüşhane','Artvin','Bayburt','Düzce','Bolu'] },
  { label: 'Doğu Anadolu',   iller: ['Erzurum','Van','Malatya','Elazığ','Erzincan','Bingöl','Muş','Bitlis','Hakkari','Tunceli','Ağrı','Ardahan','Iğdır','Kars'] },
  { label: 'Güneydoğu',      iller: ['Gaziantep','Diyarbakır','Şanlıurfa','Mardin','Siirt','Batman','Şırnak','Kilis','Adıyaman'] },
]

interface LocationSelectorProps {
  projectId: string
  existingAreas: BusinessEntity[]   // mevcut service_area entity'leri
}

export function LocationSelector({ projectId, existingAreas }: LocationSelectorProps) {
  const router  = useRouter()
  const [isPending, startTransition] = useTransition()

  // Mevcut il adlarını set olarak tut
  const existingNames = new Set(existingAreas.map(e => e.name.replace(/\s*\(.*\)/, '').trim()))

  // Yarıçap formu
  const [radiusCity, setRadiusCity] = useState('')
  const [radiusKm, setRadiusKm]     = useState('25')
  const [feedback, setFeedback]     = useState<string | null>(null)

  function flash(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }

  function addProvince(province: string) {
    if (existingNames.has(province)) return
    startTransition(async () => {
      await addBusinessEntity(projectId, {
        type:       'service_area',
        name:       province,
        seo_intent: 'local',
      })
      router.refresh()
    })
  }

  function addRegion(iller: string[]) {
    const toAdd = iller.filter(il => !existingNames.has(il))
    if (toAdd.length === 0) { flash('Bu bölgedeki tüm iller zaten ekli.'); return }
    startTransition(async () => {
      await Promise.all(toAdd.map(il => addBusinessEntity(projectId, { type: 'service_area', name: il, seo_intent: 'local' })))
      router.refresh()
    })
  }

  function addRadius() {
    const city = radiusCity.trim()
    const km   = parseInt(radiusKm, 10)
    if (!city)       { flash('Şehir adı boş olamaz.'); return }
    if (!km || km < 1) { flash('Geçerli km girin.'); return }
    const label = `${city} (${km}km çevresi)`
    startTransition(async () => {
      await addBusinessEntity(projectId, {
        type:        'service_area',
        name:        label,
        seo_intent:  'local',
        description: `${city} merkezinden ${km}km yarıçaplı hizmet alanı`,
        attributes:  { radius_km: km, center_city: city },
      })
      router.refresh()
      setRadiusCity('')
      setRadiusKm('25')
    })
  }

  function removeArea(id: string) {
    startTransition(async () => {
      await deleteBusinessEntity(projectId, id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">

      {/* ── Seçili bölgeler ── */}
      {existingAreas.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
            Seçili Lokasyonlar ({existingAreas.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {existingAreas.map(area => (
              <span
                key={area.id}
                className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1 text-[11px] text-emerald-400/80"
              >
                {area.name}
                <button
                  onClick={() => removeArea(area.id)}
                  disabled={isPending}
                  className="text-emerald-400/40 hover:text-red-400/70 transition-colors ml-0.5 leading-none"
                  title="Kaldır"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Bölge kısayolları ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
          Bölgeye Göre Toplu Ekle
        </p>
        <div className="flex flex-wrap gap-1.5">
          {REGION_SHORTCUTS.map(r => (
            <button
              key={r.label}
              onClick={() => addRegion(r.iller)}
              disabled={isPending}
              className="rounded border border-border/40 px-2.5 py-1 text-[11px] text-muted-foreground/60 hover:border-blue-500/30 hover:text-blue-400/70 hover:bg-blue-500/5 transition-colors disabled:opacity-40"
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => {
              const all = TR_PROVINCES.filter(p => !existingNames.has(p))
              if (all.length === 0) { flash('Tüm iller zaten ekli.'); return }
              startTransition(async () => {
                await Promise.all(all.map(p => addBusinessEntity(projectId, { type: 'service_area', name: p, seo_intent: 'local' })))
                router.refresh()
              })
            }}
            disabled={isPending}
            className="rounded border border-border/30 px-2.5 py-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors disabled:opacity-40"
          >
            Tüm Türkiye
          </button>
        </div>
      </div>

      {/* ── 81 İl listesi ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
          İl Seç
        </p>
        <div className="flex flex-wrap gap-1">
          {TR_PROVINCES.map(province => {
            const selected = existingNames.has(province)
            return (
              <button
                key={province}
                onClick={() => addProvince(province)}
                disabled={isPending || selected}
                title={selected ? 'Zaten eklendi' : `${province} ekle`}
                className={[
                  'rounded px-2 py-0.5 text-[11px] transition-colors border',
                  selected
                    ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400/60 cursor-default'
                    : 'border-border/30 text-muted-foreground/50 hover:border-blue-500/25 hover:text-blue-400/70 hover:bg-blue-500/5',
                ].join(' ')}
              >
                {province}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Yarıçap ile ekle ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
          Yarıçap ile Ekle
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={radiusCity}
            onChange={e => setRadiusCity(e.target.value)}
            placeholder="Şehir / Merkez nokta"
            className="flex-1 min-w-[140px] rounded-md border border-border/40 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/30 outline-none focus:border-border/70 transition-colors"
          />
          <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-transparent px-3 py-2">
            <input
              type="number"
              value={radiusKm}
              onChange={e => setRadiusKm(e.target.value)}
              min="1"
              max="500"
              className="w-12 bg-transparent text-sm text-center outline-none"
            />
            <span className="text-[11px] text-muted-foreground/50">km</span>
          </div>
          <button
            onClick={addRadius}
            disabled={isPending}
            className="rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground/70 hover:bg-secondary/50 transition-colors disabled:opacity-40"
          >
            Ekle
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 mt-1.5">
          Örnek: "İstanbul" + 30km → "İstanbul (30km çevresi)"
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <p className="text-[11px] text-amber-400/70">{feedback}</p>
      )}

      {isPending && (
        <p className="text-[11px] text-muted-foreground/40">Kaydediliyor…</p>
      )}
    </div>
  )
}
