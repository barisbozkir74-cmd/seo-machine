export const RULE_META: Record<string, { label: string; recommended: boolean; category: string }> = {
  title_starts_with_keyword: { label: 'SEO title focus keyword ile başlamalı', recommended: true, category: 'SEO Title' },
  title_max_length_enforced: { label: 'Max 60 karakter sınırı zorunlu', recommended: true, category: 'SEO Title' },
  title_includes_brand:      { label: 'SEO title marka adıyla bitmeli', recommended: false, category: 'SEO Title' },
  h1_exact_match:            { label: 'H1 focus keyword exact match olmalı', recommended: false, category: 'H1' },
  h1_single_per_page:        { label: 'Sayfada yalnızca 1 adet H1 kullanılmalı', recommended: true, category: 'H1' },
  h1_includes_keyword:       { label: 'H1 focus keyword içermeli', recommended: true, category: 'H1' },
  slug_exact_match:          { label: 'Slug focus keyword exact match olmalı', recommended: false, category: 'Slug' },
  slug_lowercase_hyphen:     { label: 'Slug küçük harf + tire zorunlu, noktalama yasak', recommended: true, category: 'Slug' },
  slug_no_stopwords:         { label: "Slug'dan Türkçe stopword çıkarılmalı", recommended: false, category: 'Slug' },
  meta_desc_required:        { label: 'Meta description zorunlu', recommended: true, category: 'Meta Description' },
  meta_desc_includes_keyword:{ label: 'Meta desc focus keyword içermeli', recommended: true, category: 'Meta Description' },
  meta_desc_length_enforced: { label: '120–160 karakter aralığı zorunlu', recommended: true, category: 'Meta Description' },
}

export const CATEGORIES = ['SEO Title', 'H1', 'Slug', 'Meta Description'] as const
