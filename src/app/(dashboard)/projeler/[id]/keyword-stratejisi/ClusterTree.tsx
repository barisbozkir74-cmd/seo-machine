'use client'

import { useState } from 'react'
import { IntentBadge } from './IntentBadge'
import { StatusBadge } from './StatusBadge'
import { ClusterDeleteButton } from './ClusterDeleteButton'
import { PrimaryKeywordStar } from './PrimaryKeywordStar'
import { MoveKeywordDialog } from './MoveKeywordDialog'
import { KeywordDeleteButton } from './KeywordDeleteButton'
import { RevenueBadge } from './RevenueBadge'
import { RevenueOverrideSelect } from './RevenueOverrideSelect'

type KeywordRole =
  | 'focus' | 'supporting' | 'synonym' | 'long_tail'
  | 'question' | 'commercial' | 'local' | 'comparison' | 'separate_page'

type TreeKeyword = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  opportunity_score: number | null
  parent_keyword_id: string | null
  is_starred: boolean
  is_ai_suggested: boolean
  long_tail_flag: boolean
  faq_flag: boolean
  comparison_flag: boolean
  keyword_role: string | null
}

type TreeCluster = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  opportunity_score: number | null
  revenue_type: string | null
  status: string | null
  cannibalization_status: string | null
  link_tier: string | null
  keywords: TreeKeyword[]
}

type ClusterOption = {
  id: string
  cluster_name: string
  intent: string | null
  keyword_count: number
}

const ROLE_GROUPS: { role: Exclude<KeywordRole, 'focus'>; label: string; color: string; defaultOpen: boolean }[] = [
  { role: 'supporting',    label: 'Supporting',           color: 'text-blue-400',    defaultOpen: true },
  { role: 'synonym',       label: 'Synonym / Varyasyon',  color: 'text-teal-400',    defaultOpen: true },
  { role: 'long_tail',     label: 'Long Tail',            color: 'text-slate-400',   defaultOpen: true },
  { role: 'question',      label: 'Question / FAQ',       color: 'text-sky-400',     defaultOpen: true },
  { role: 'commercial',    label: 'Commercial Modifiers', color: 'text-amber-400',   defaultOpen: true },
  { role: 'local',         label: 'Local Modifiers',      color: 'text-emerald-400', defaultOpen: true },
  { role: 'comparison',    label: 'Comparison',           color: 'text-orange-400',  defaultOpen: true },
  { role: 'separate_page', label: 'Separate Page',        color: 'text-violet-400',  defaultOpen: true },
]

function deriveRole(kw: TreeKeyword, primaryKeywordId: string | null): KeywordRole {
  if (kw.id === primaryKeywordId) return 'focus'
  if (kw.keyword_role) return kw.keyword_role as KeywordRole
  if (kw.parent_keyword_id) return 'long_tail'
  if (kw.long_tail_flag) return 'long_tail'
  if (kw.faq_flag) return 'question'
  if (kw.comparison_flag) return 'comparison'
  return 'supporting'
}

function kdInfo(kd: number | null) {
  if (kd === null) return { dot: 'bg-muted-foreground/20', label: '—', cls: 'text-muted-foreground' }
  if (kd < 30) return { dot: 'bg-emerald-400', label: String(kd), cls: 'text-emerald-400' }
  if (kd <= 60) return { dot: 'bg-amber-400', label: String(kd), cls: 'text-amber-400' }
  return { dot: 'bg-red-400', label: String(kd), cls: 'text-red-400' }
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}

function OppScore({ score }: { score: number | null }) {
  if (score === null) return <span className="w-10 text-right text-xs text-muted-foreground">—</span>
  const cls = score >= 70
    ? 'bg-violet-500/20 text-violet-400'
    : score >= 40
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-secondary text-muted-foreground'
  return (
    <span className={`inline-flex items-center justify-center text-[11px] font-medium px-1.5 py-0.5 rounded w-10 ${cls}`}>
      {score.toFixed(0)}
    </span>
  )
}

// ─── Column header shared across rows ────────────────────────────────────────

function ColHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-1 border-b border-border/30 bg-secondary/10">
      <span className="flex-1" />
      <span className="w-16 text-right text-[10px] text-muted-foreground/50 uppercase tracking-wide shrink-0">Vol</span>
      <span className="w-14 text-right text-[10px] text-muted-foreground/50 uppercase tracking-wide shrink-0">CPC</span>
      <span className="w-16 text-right text-[10px] text-muted-foreground/50 uppercase tracking-wide shrink-0">KD</span>
      <span className="w-10 text-right text-[10px] text-muted-foreground/50 uppercase tracking-wide shrink-0">Opp</span>
      <span className="w-10 shrink-0" /> {/* actions spacer */}
    </div>
  )
}

// ─── Single keyword row ───────────────────────────────────────────────────────

function KwRow({
  kw, projectId, cluster, allClusters, isFocus = false, localeFlaggedIds,
}: {
  kw: TreeKeyword
  projectId: string
  cluster: TreeCluster
  allClusters: ClusterOption[]
  isFocus?: boolean
  localeFlaggedIds?: Set<string>
}) {
  const ki = kdInfo(kw.difficulty)
  return (
    <div className={`group flex items-center gap-2 px-4 py-2 border-t border-border/30 hover:bg-secondary/20 transition-colors ${isFocus ? 'bg-amber-500/5' : ''}`}>
      <PrimaryKeywordStar
        keywordId={kw.id}
        projectId={projectId}
        isStarred={kw.is_starred}
        isAiSuggested={kw.is_ai_suggested}
      />
      <span className={`flex-1 text-sm min-w-0 truncate flex items-center gap-1.5 ${isFocus ? 'font-semibold' : 'font-normal'}`}>
        <span className="truncate">{kw.keyword}</span>
        {localeFlaggedIds?.has(kw.id) && (
          <span
            className="shrink-0 rounded border border-blue-400/30 bg-blue-400/10 px-1 py-0 text-[9px] font-medium text-blue-400/70 select-none"
            title="Dil Uyarısı: Bu keyword Türkçe karakter içermiyor"
          >
            EN?
          </span>
        )}
      </span>
      <span className="w-16 text-right text-xs tabular-nums text-muted-foreground shrink-0">
        {kw.volume !== null ? fmtVol(kw.volume) : '—'}
      </span>
      <span className="w-14 text-right text-xs tabular-nums text-muted-foreground shrink-0">
        {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '—'}
      </span>
      <span className="w-16 flex items-center justify-end gap-1.5 shrink-0">
        {kw.difficulty !== null ? (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${ki.dot}`} />
            <span className={`text-xs ${ki.cls}`}>{ki.label}</span>
          </>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </span>
      <div className="w-10 flex justify-end shrink-0">
        <OppScore score={kw.opportunity_score} />
      </div>
      <MoveKeywordDialog
        keywordId={kw.id}
        keywordText={kw.keyword}
        currentClusterId={cluster.id}
        projectId={projectId}
        allClusters={allClusters}
      />
      <KeywordDeleteButton projectId={projectId} keywordId={kw.id} />
    </div>
  )
}

// ─── Collapsible role group ───────────────────────────────────────────────────

function RoleGroup({
  role, label, color, defaultOpen, keywords, projectId, cluster, allClusters, localeFlaggedIds,
}: {
  role: string
  label: string
  color: string
  defaultOpen: boolean
  keywords: TreeKeyword[]
  projectId: string
  cluster: TreeCluster
  allClusters: ClusterOption[]
  localeFlaggedIds?: Set<string>
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (keywords.length === 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-1.5 bg-secondary/15 border-t border-border/40 hover:bg-secondary/25 transition-colors text-left"
      >
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          className={`shrink-0 text-muted-foreground/40 transition-transform duration-150 ${open ? 'rotate-90' : 'rotate-0'}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${color}`}>{label}</span>
        <span className="text-[11px] text-muted-foreground/50">({keywords.length})</span>
        <span className="text-[10px] text-muted-foreground/30 tabular-nums ml-1">
          {keywords.reduce((s, k) => s + (k.volume ?? 0), 0) > 0
            ? fmtVol(keywords.reduce((s, k) => s + (k.volume ?? 0), 0)) + ' vol'
            : ''}
        </span>
      </button>
      {open && keywords.map((kw) => (
        <KwRow key={kw.id} kw={kw} projectId={projectId} cluster={cluster} allClusters={allClusters} localeFlaggedIds={localeFlaggedIds} />
      ))}
    </div>
  )
}

// ─── Cluster card ─────────────────────────────────────────────────────────────

function ClusterCard({
  cluster, allClusters, projectId, localeFlaggedIds,
}: {
  cluster: TreeCluster
  allClusters: ClusterOption[]
  projectId: string
  localeFlaggedIds?: Set<string>
}) {
  const focusKws: TreeKeyword[] = []
  const roleMap = new Map<KeywordRole, TreeKeyword[]>()

  for (const kw of cluster.keywords) {
    const role = deriveRole(kw, cluster.primary_keyword_id)
    if (role === 'focus') {
      focusKws.push(kw)
    } else {
      if (!roleMap.has(role)) roleMap.set(role, [])
      roleMap.get(role)!.push(kw)
    }
  }

  const totalVol = cluster.keywords.reduce((s, k) => s + (k.volume ?? 0), 0)
  const enrichedForKD = cluster.keywords.filter((k) => k.difficulty !== null)
  const avgKD = enrichedForKD.length > 0
    ? Math.round(enrichedForKD.reduce((s, k) => s + (k.difficulty ?? 0), 0) / enrichedForKD.length)
    : null
  const ki = kdInfo(avgKD)

  const borderCls = cluster.status === 'approved'
    ? 'border-emerald-500/30'
    : cluster.status === 'rejected'
    ? 'border-border/30 opacity-60'
    : 'border-border'

  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${borderCls}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-semibold truncate max-w-xs">{cluster.cluster_name}</span>
          <StatusBadge status={cluster.status} />
          <IntentBadge intent={cluster.intent} />
          {cluster.link_tier && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
              cluster.link_tier === 'pillar'
                ? 'bg-violet-500/15 text-violet-400'
                : cluster.link_tier === 'cluster'
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-secondary text-muted-foreground'
            }`}>
              {cluster.link_tier === 'pillar' ? 'Pillar' : cluster.link_tier === 'cluster' ? 'Cluster' : 'Destek'}
            </span>
          )}
          {cluster.cannibalization_status === 'warning' && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0"
              title="Başka bir kümeyle keyword çakışması var"
            >
              ⚠ Çakışma
            </span>
          )}
        </div>

        {/* Metric strip + controls */}
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {totalVol > 0 && (
              <span className="tabular-nums">
                {fmtVol(totalVol)}<span className="text-muted-foreground/40 ml-0.5">vol</span>
              </span>
            )}
            <span>
              {cluster.keywords.length}<span className="text-muted-foreground/40 ml-0.5">kw</span>
            </span>
            {avgKD !== null && (
              <span className={`tabular-nums font-medium ${ki.cls}`}>KD {avgKD}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <RevenueBadge revenueType={cluster.revenue_type} />
            <RevenueOverrideSelect
              clusterId={cluster.id}
              projectId={projectId}
              currentRevenue={cluster.revenue_type}
            />
          </div>
          <OppScore score={cluster.opportunity_score} />
          <ClusterDeleteButton
            projectId={projectId}
            clusterId={cluster.id}
            clusterName={cluster.cluster_name}
          />
        </div>
      </div>

      {/* ── Column header (once, before all rows) ── */}
      {cluster.keywords.length > 0 && <ColHeader />}

      {/* ── Focus Keyword ── */}
      {focusKws.length > 0 && (
        <div className="border-t border-amber-500/20 bg-amber-500/5">
          <div className="px-4 py-1 flex items-center gap-1.5 border-b border-amber-500/15">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400/70 shrink-0">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">Focus Keyword</span>
          </div>
          {focusKws.map((kw) => (
            <KwRow key={kw.id} kw={kw} projectId={projectId} cluster={cluster} allClusters={allClusters} isFocus localeFlaggedIds={localeFlaggedIds} />
          ))}
        </div>
      )}

      {/* ── 8 Role Groups ── */}
      {ROLE_GROUPS.map(({ role, label, color, defaultOpen }) => (
        <RoleGroup
          key={role}
          role={role}
          label={label}
          color={color}
          defaultOpen={defaultOpen}
          keywords={roleMap.get(role) ?? []}
          projectId={projectId}
          cluster={cluster}
          allClusters={allClusters}
          localeFlaggedIds={localeFlaggedIds}
        />
      ))}

      {cluster.keywords.length === 0 && (
        <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border/30">
          Keyword yok
        </p>
      )}
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function ClusterTree({
  clusters,
  allClusters,
  projectId,
  localeFlaggedIds,
}: {
  clusters: TreeCluster[]
  allClusters: ClusterOption[]
  projectId: string
  localeFlaggedIds?: Set<string>
}) {
  if (clusters.length === 0) {
    return (
      <div className="py-12 text-center space-y-1">
        <p className="text-sm text-muted-foreground">Henüz küme oluşturulmadı.</p>
        <p className="text-xs text-muted-foreground">
          Sağ üstteki &ldquo;AI ile Kümelendirme&rdquo; butonuna bas — GPT keyword&apos;leri anlamsal gruplara ayırsın.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {clusters.map((cluster) => (
        <ClusterCard
          key={cluster.id}
          cluster={cluster}
          allClusters={allClusters}
          projectId={projectId}
          localeFlaggedIds={localeFlaggedIds}
        />
      ))}
    </div>
  )
}
