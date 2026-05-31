import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RuleToggleRow } from '@/components/rules/RuleToggleRow'
import { toggleProjectRule, resetProjectRule } from '@/app/(dashboard)/projeler/[id]/kurallar/actions'
import { RULE_META, CATEGORIES } from '@/lib/rules/rule-meta'
import { ManagerRulesSection } from '@/app/(dashboard)/projeler/[id]/kurallar/ManagerRulesSection'
import { ComplianceTestPanel } from '@/app/(dashboard)/projeler/[id]/kurallar/ComplianceTestPanel'
import { readAllManagerRules } from '@/lib/ai-managers/rules'
import { RESEARCH_MANAGER } from '@/lib/ai-managers/identities'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'

export default async function SettingsRulesPage({
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
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const [{ data: globalRules }, { data: projectRules }] = await Promise.all([
    supabase.from('rules').select('rule_key, rule_value').eq('user_id', user.id).eq('scope', 'global').is('project_id', null),
    supabase.from('rules').select('rule_key, rule_value').eq('user_id', user.id).eq('project_id', id).eq('scope', 'project'),
  ])

  const managerRulesMap = await readAllManagerRules(id, user.id, supabase)

  const projectOverrides = Object.fromEntries((projectRules ?? []).map((r) => [r.rule_key, r.rule_value]))
  const globalValues     = Object.fromEntries((globalRules ?? []).map((r) => [r.rule_key, r.rule_value]))

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
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Kural Yönetimi</span>
      </div>

      <SplitPane
        storageKey="kurallar"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Kural Yöneticisi"
            managerName="SEO Kural Uzmanı"
            hint="Aktif SEO kurallarını denetler, çakışmaları tespit eder ve kural önerileri sunar."
            section="kurallar"
          />
        }
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-8">
          {/* AI Manager Identity Rules */}
          <div>
            <p className="text-xs font-normal uppercase text-muted-foreground mb-3">AI Yönetici Kimlik Kuralları</p>
            <div className="space-y-4">
              <ManagerRulesSection
                projectId={id}
                manager={RESEARCH_MANAGER}
                initialContent={managerRulesMap[RESEARCH_MANAGER.id] ?? RESEARCH_MANAGER.systemPrompt}
              />
              <ComplianceTestPanel projectId={id} />
            </div>
          </div>

          {/* Rule categories */}
          {CATEGORIES.map((category) => {
            const categoryRules = Object.entries(RULE_META).filter(([, meta]) => meta.category === category)
            return (
              <div key={category}>
                <p className="text-xs font-normal uppercase text-muted-foreground mb-3">{category}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-normal uppercase text-muted-foreground w-24">Kaynak</TableHead>
                      <TableHead className="text-xs font-normal uppercase text-muted-foreground">Kural</TableHead>
                      <TableHead className="text-xs font-normal uppercase text-muted-foreground w-48">Önerilen</TableHead>
                      <TableHead className="text-xs font-normal uppercase text-muted-foreground w-16">Durum</TableHead>
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
      </SplitPane>
    </div>
  )
}
