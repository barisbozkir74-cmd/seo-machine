// D-06 slug üretim kuralları: lowercase, Türkçe normalize, max 60, -2/-3 suffix

const TR_MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'c',
  'ş': 's', 'Ş': 's',
  'ğ': 'g', 'Ğ': 'g',
  'ü': 'u', 'Ü': 'u',
  'ö': 'o', 'Ö': 'o',
  'ı': 'i', 'İ': 'i',
}

const MAX_SLUG_LENGTH = 60
const FALLBACK_SLUG = 'page'

function normalize(input: string): string {
  let out = ''
  for (const ch of input) {
    out += TR_MAP[ch] ?? ch
  }
  return out
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // özel karakterleri sil (harfler, rakamlar, boşluk, tire kalır)
    .replace(/\s+/g, '-')            // boşlukları tireye çevir
    .replace(/-+/g, '-')             // ardışık tireleri tek'e indir
    .replace(/^-+|-+$/g, '')         // baş/son tirelerini kırp
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')             // trim'den sonra oluşan sondaki tireyi kırp (60. karakter denk gelirse)
}

/**
 * D-06 kurallarıyla slug üretir. existingSlugs içinde çakışma varsa -2, -3 ... ekler.
 * Boş input fallback olarak 'page' döner (pages.slug NOT NULL).
 */
export function slugify(text: string, existingSlugs: string[] = []): string {
  let base = normalize(text)
  if (!base) base = FALLBACK_SLUG

  const used = new Set(existingSlugs)
  if (!used.has(base)) return base

  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
