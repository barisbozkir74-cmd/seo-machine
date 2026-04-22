import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { seedGlobalRules, toggleRule } from './actions'
import { RuleToggleRow } from '@/components/rules/RuleToggleRow'
import { RULE_META, CATEGORIES } from '@/lib/rules/rule-meta'

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
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground w-24">
                      Kapsam
                    </TableHead>
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                      Kural
                    </TableHead>
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground w-48">
                      Önerilen
                    </TableHead>
                    <TableHead className="text-xs font-normal uppercase text-muted-foreground w-16 text-right">
                      Durum
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRules.map(([ruleKey, meta]) => {
                    const currentValue = ruleValues[ruleKey] ?? meta.recommended
                    return (
                      <TableRow key={ruleKey}>
                        <RuleToggleRow
                          ruleKey={ruleKey}
                          label={meta.label}
                          currentValue={currentValue}
                          recommendedValue={meta.recommended}
                          scope="global"
                          toggleAction={toggleRule}
                        />
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
