// server-only değil — pure function, test edilebilir, client da kullanabilir
// TopPageItem client.ts'deki ile aynı shape ama bağımsız tanım (bağımsız bundle)

export type TopPageItem = {
  page_address: string
  metrics?: {
    organic?: {
      etv?: number
    }
  }
}

export type CategoryStructure = {
  [category: string]: {
    pageCount: number
    sampleUrls: string[]
    totalEtv: number
  }
}

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\/blog\//i,              category: 'Blog' },
  { pattern: /\/urunler?\//i,          category: 'Ürün Sayfaları' },
  { pattern: /\/hizmetler?\//i,        category: 'Hizmetler' },
  { pattern: /\/kategori\//i,          category: 'Kategori Sayfaları' },
  { pattern: /\/products?\//i,         category: 'Ürün Sayfaları' },
  { pattern: /\/services?\//i,         category: 'Hizmetler' },
  { pattern: /\/category\//i,          category: 'Kategori Sayfaları' },
  { pattern: /\/shop\//i,              category: 'Mağaza' },
  { pattern: /\/news\//i,              category: 'Haberler' },
  { pattern: /\/about\//i,             category: 'Hakkında' },
  { pattern: /\/hakkimizda\//i,        category: 'Hakkında' },
  { pattern: /\/iletisim\//i,          category: 'İletişim' },
  { pattern: /\/contact\//i,           category: 'İletişim' },
  { pattern: /\/fiyat\//i,             category: 'Fiyatlandırma' },
  { pattern: /\/pricing\//i,           category: 'Fiyatlandırma' },
]

export function extractCategories(pages: TopPageItem[]): CategoryStructure {
  const result: CategoryStructure = {}

  for (const page of pages) {
    let matched = false
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(page.page_address)) {
        if (!result[category]) {
          result[category] = { pageCount: 0, sampleUrls: [], totalEtv: 0 }
        }
        result[category].pageCount++
        result[category].totalEtv += page.metrics?.organic?.etv ?? 0
        if (result[category].sampleUrls.length < 3) {
          result[category].sampleUrls.push(page.page_address)
        }
        matched = true
        break
      }
    }
    if (!matched) {
      if (!result['Diğer']) {
        result['Diğer'] = { pageCount: 0, sampleUrls: [], totalEtv: 0 }
      }
      result['Diğer'].pageCount++
    }
  }

  return result
}
