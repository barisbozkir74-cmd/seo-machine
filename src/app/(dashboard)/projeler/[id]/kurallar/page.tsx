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
import { RuleToggleRow } from '@/components/rules/RuleToggleRow'
import { toggleProjectRule, resetProjectRule } from './actions'
import { RULE_META, CATEGORIES } from '@/lib/rules/rule-meta'
import { ProjectNav } from '../ProjectNav'

export default async function ProjeKurallarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Global kurallar
  const { data: globalRules } = await supabase
    .from('rules')
    .select('rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)

  // Proje override'ları
  const { data: projectRules } = await supabase
    .from('rules')
    .select('rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('project_id', id)
    .eq('scope', 'project')

  // Proje override map: rule_key → rule_value
  const projectOverrides = Object.fromEntries(
    (projectRules ?? []).map((r) => [r.rule_key, r.rule_value])
  )

  // Global map: rule_key → rule_value
  const globalValues = Object.fromEntries(
    (globalRules ?? []).map((r) => [r.rule_key, r.rule_value])
  )

  // Her kural için: proje override varsa scope='project', yoksa scope='global'
  const resolvedRules = Object.fromEntries(
    Object.keys(RULE_META).map((ruleKey) => {
      const hasOverride = ruleKey in projectOverrides
      const value = hasOverride
        ? projectOverrides[ruleKey] === 'true'
        : (globalValues[ruleKey] ?? 'true') === 'true'
      const scope: 'global' | 'project' = hasOverride ? 'project' : 'global'
      return [ruleKey, { value, scope }]
    })
  )

  return (
    <div className="flex flex-col h-screen">
      {/* Breadcrumb + başlık */}
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Proje Kuralları</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bu projeye özel kural override'ları. Override yapılmayan kurallar global ayarları kullanır.
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/kurallar`} />
        </div>

        {/* Sağ sütun — kural tablosu */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8">
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
                          Kaynak
                        </TableHead>
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
                        const resolved = resolvedRules[ruleKey]
                        const isProjectScope = resolved.scope === 'project'
                        return (
                          <TableRow key={ruleKey}>
                            <RuleToggleRow
                              ruleKey={ruleKey}
                              label={meta.label}
                              currentValue={resolved.value}
                              recommendedValue={meta.recommended}
                              scope={resolved.scope}
                              toggleAction={toggleProjectRule.bind(null, id)}
                              resetAction={
                                isProjectScope
                                  ? resetProjectRule.bind(null, id, ruleKey)
                                  : undefined
                              }
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
        </div>
      </div>
    </div>
  )
}
