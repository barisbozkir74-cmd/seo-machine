// DataForSEO location_code ve language_code mapping
// Ülke/dil adı (TR veya EN) → DataForSEO kodu

const COUNTRY_TO_LOCATION: Record<string, number> = {
  // Türkçe isimler
  türkiye: 2792,
  ingiltere: 2826,
  'birleşik krallık': 2826,
  amerika: 2840,
  'abd': 2840,
  almanya: 2276,
  fransa: 2250,
  ispanya: 2724,
  italya: 2380,
  hollanda: 2528,
  polonya: 2616,
  avustralya: 2036,
  kanada: 2124,
  belçika: 2056,
  portekiz: 2620,
  // İngilizce isimler
  turkey: 2792,
  'united kingdom': 2826,
  uk: 2826,
  'great britain': 2826,
  england: 2826,
  'united states': 2840,
  usa: 2840,
  us: 2840,
  germany: 2276,
  france: 2250,
  spain: 2724,
  italy: 2380,
  netherlands: 2528,
  poland: 2616,
  australia: 2036,
  canada: 2124,
  belgium: 2056,
  portugal: 2620,
}

const LANGUAGE_TO_CODE: Record<string, string> = {
  // Türkçe isimler
  türkçe: 'tr',
  ingilizce: 'en',
  almanca: 'de',
  fransızca: 'fr',
  ispanyolca: 'es',
  italyanca: 'it',
  hollandaca: 'nl',
  portekizce: 'pt',
  // İngilizce isimler
  turkish: 'tr',
  english: 'en',
  german: 'de',
  french: 'fr',
  spanish: 'es',
  italian: 'it',
  dutch: 'nl',
  portuguese: 'pt',
  polish: 'pl',
  // ISO kodları
  tr: 'tr',
  en: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  nl: 'nl',
  pt: 'pt',
  pl: 'pl',
}

// Ülkeye göre varsayılan dil
const COUNTRY_DEFAULT_LANGUAGE: Record<number, string> = {
  2792: 'tr',
  2826: 'en',
  2840: 'en',
  2276: 'de',
  2250: 'fr',
  2724: 'es',
  2380: 'it',
  2528: 'nl',
  2616: 'pl',
  2036: 'en',
  2124: 'en',
  2056: 'nl',
  2620: 'pt',
}

export function resolveLocation(
  targetCountry?: string | null,
  targetLanguage?: string | null
): { locationCode: number; languageCode: string } {
  const countryKey = targetCountry?.toLowerCase().trim() ?? ''
  const languageKey = targetLanguage?.toLowerCase().trim() ?? ''

  const locationCode = COUNTRY_TO_LOCATION[countryKey] ?? 2792
  const languageCode =
    LANGUAGE_TO_CODE[languageKey] ??
    COUNTRY_DEFAULT_LANGUAGE[locationCode] ??
    'tr'

  return { locationCode, languageCode }
}
