'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addBusinessEntity, deleteBusinessEntity } from '@/app/(dashboard)/projeler/[id]/isletme/actions'
import type { BusinessEntity } from '@/app/(dashboard)/projeler/[id]/isletme/actions'

// ─── Veri ──────────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'TR', label: 'Türkiye' },
  { code: 'DE', label: 'Almanya' },
  { code: 'NL', label: 'Hollanda' },
  { code: 'GB', label: 'Birleşik Krallık' },
  { code: 'AT', label: 'Avusturya' },
  { code: 'CH', label: 'İsviçre' },
  { code: 'BE', label: 'Belçika' },
  { code: 'FR', label: 'Fransa' },
  { code: 'AE', label: 'BAE' },
  { code: 'OTHER', label: 'Diğer' },
]

const TR_PROVINCES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Ardahan',
  'Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis',
  'Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce',
  'Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane',
  'Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük',
  'Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir',
  'Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Siirt','Sinop',
  'Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van',
  'Yalova','Yozgat','Zonguldak',
]

// ─── Tip ───────────────────────────────────────────────────────────────────────

interface LocationSelectorProps {
  projectId:     string
  existingAreas: BusinessEntity[]
}

// Kaydedilen lokasyonun yapısını attribute'dan okur
function parseLocation(entity: BusinessEntity) {
  const attrs = entity.attributes as Record<string, string> | null
  return {
    country:  attrs?.country  ?? '',
    province: attrs?.province ?? '',
    district: attrs?.district ?? '',
    radius:   attrs?.radius   ?? '',
  }
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export function LocationSelector({ projectId, existingAreas }: LocationSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [country,  setCountry]  = useState('TR')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [radius,   setRadius]   = useState('')
  const [error,    setError]    = useState('')

  function buildName(): string {
    const countryLabel = COUNTRIES.find(c => c.code === country)?.label ?? country
    const parts = [countryLabel]
    if (province) parts.push(province)
    if (district) parts.push(district)
    if (radius)   parts.push(`(${radius}km çevresi)`)
    return parts.join(' › ')
  }

  function handleAdd() {
    if (!province && country === 'TR') {
      setError('Lütfen bir il seçin.')
      return
    }
    setError('')
    const name = buildName()
    startTransition(async () => {
      await addBusinessEntity(projectId, {
        type:        'service_area',
        name,
        seo_intent:  'local',
        description: radius ? `${province || country} merkezinden ${radius}km yarıçaplı hizmet alanı` : undefined,
        attributes:  { country, province, district, radius },
      })
      // Formu sıfırla (ülke koru)
      setProvince('')
      setDistrict('')
      setRadius('')
      router.refresh()
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await deleteBusinessEntity(projectId, id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">

      {/* ── Ekleme formu ── */}
      <div className="rounded-xl border border-border/40 bg-secondary/10 p-5 space-y-4">
        <p className="text-xs font-semibold text-foreground/70">Yeni Hizmet Bölgesi Ekle</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* Ülke */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Ülke
            </label>
            <select
              value={country}
              onChange={e => { setCountry(e.target.value); setProvince(''); setDistrict('') }}
              className="w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm outline-none focus:border-border/80 transition-colors"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* İl — Türkiye ise dropdown, diğerleri text input */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              İl / Şehir
            </label>
            {country === 'TR' ? (
              <select
                value={province}
                onChange={e => { setProvince(e.target.value); setDistrict('') }}
                className="w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm outline-none focus:border-border/80 transition-colors"
              >
                <option value="">İl seçin…</option>
                {TR_PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={province}
                onChange={e => setProvince(e.target.value)}
                placeholder="Şehir girin…"
                className="w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/30"
              />
            )}
          </div>

          {/* İlçe — isteğe bağlı */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              İlçe <span className="text-muted-foreground/30 normal-case">(isteğe bağlı)</span>
            </label>
            <input
              type="text"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              placeholder="İlçe girin…"
              className="w-full rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm outline-none focus:border-border/80 transition-colors placeholder:text-muted-foreground/30"
            />
          </div>

          {/* Yarıçap — isteğe bağlı */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Yarıçap <span className="text-muted-foreground/30 normal-case">(isteğe bağlı)</span>
            </label>
            <div className="flex items-center rounded-lg border border-border/40 bg-background/60 overflow-hidden focus-within:border-border/80 transition-colors">
              <input
                type="number"
                value={radius}
                onChange={e => setRadius(e.target.value)}
                placeholder="30"
                min="1"
                max="500"
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/30"
              />
              <span className="px-3 text-[11px] text-muted-foreground/40 border-l border-border/30 select-none">km</span>
            </div>
          </div>

        </div>

        {/* Önizleme + hata + ekle */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            {error ? (
              <p className="text-[11px] text-amber-400/70">{error}</p>
            ) : (province || country !== 'TR') ? (
              <p className="text-[11px] text-muted-foreground/50 truncate">
                <span className="text-muted-foreground/30">Önizleme: </span>
                {buildName()}
              </p>
            ) : null}
          </div>
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="flex-shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-[12px] font-medium text-blue-400/80 hover:bg-blue-500/15 transition-colors disabled:opacity-40"
          >
            {isPending ? 'Ekleniyor…' : '+ Bölge Ekle'}
          </button>
        </div>
      </div>

    </div>
  )
}
