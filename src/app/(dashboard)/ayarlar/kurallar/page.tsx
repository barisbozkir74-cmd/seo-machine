import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { seedGlobalRules } from './actions'
// RuleToggleRow Plan 03-02'de eklenecek — şimdi sadece tablo satırını statik render et

const RULE_META: Record<string, { label: string; recommended: boolean; category: string }> = {
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

const CATEGORIES = ['SEO Title', 'H1', 'Slug', 'Meta Description'] as const

export default async function GlobalKurallarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Global kuralları çek
  let { data: rules } = await supabase
    .from('rules')
    .select('id, rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)

  // Seed guard: kurallar yoksa seed et ve yeniden çek
  if (!rules || rules.length === 0) {
    await seedGlobalRules()
    const { data: seeded } = await supabase
      .from('rules')
      .select('id, rule_key, rule_value')
      .eq('user_id', user.id)
      .eq('scope', 'global')
      .is('project_id', null)
    rules = seeded ?? []
  }

  // rule_key → rule_value map
  const ruleValues = Object.fromEntries(
    (rules ?? []).map((r) => [r.rule_key, r.rule_value === 'true'])
  )

  return (
    <main className="p-8">
      <Link
        href="/projeler"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
      >
        ← Dashboard
      </Link>
      <h1 className="text-xl font-semibold">Global SEO Kuralları</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Tüm projeler için varsayılan kural seti. Proje bazlı override yapılmayan kurallar bu değerleri kullanır.
      </p>

      <div className="space-y-8">
        {CATEGORIES.map((category) => {
          const categoryRules = Object.entries(RULE_META).filter(
            ([, meta]) => meta.category === category
          )
          return (
            <div key={category}>
              <p className="text-xs font-normal uppercase text-muted-foreground mb-3">
                {category}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                      Kural
                    </TableHead>
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground w-48">
                      Önerilen
                    </TableHead>
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground w-16">
                      Durum
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRules.map(([ruleKey, meta]) => {
                    const currentValue = ruleValues[ruleKey] ?? meta.recommended
                    const matchesRecommended = currentValue === meta.recommended
                    return (
                      <TableRow key={ruleKey}>
                        <TableCell className="text-sm">{meta.label}</TableCell>
                        <TableCell>
                          <span className={matchesRecommended ? 'text-xs text-muted-foreground' : 'text-xs text-amber-400'}>
                            Önerilen: {meta.recommended ? 'Açık' : 'Kapalı'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {/* Plan 03-02'de RuleToggleRow ile değiştirilecek */}
                          <span className="text-xs text-muted-foreground">
                            {currentValue ? 'Açık' : 'Kapalı'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )
        })}
      </div>
    </main>
  )
}
