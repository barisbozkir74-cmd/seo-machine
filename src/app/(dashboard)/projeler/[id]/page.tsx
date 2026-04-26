import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, RadioButtonIcon, CircleIcon } from '@hugeicons/core-free-icons'
import { StageTransition } from './stage-transition'
import { NotesSection } from './notes-section'
import { hasWordPressCredentials } from '@/lib/supabase/vault'
import { WordPressConnectionSection } from './wordpress-section'

type Stage = {
  id: string
  stage_name: string
  status: 'active' | 'completed' | 'pending'
  started_at: string | null
  completed_at: string | null
}

type Project = {
  id: string
  name: string
  domain: string | null
  sector: string | null
  target_country: string | null
  target_language: string | null
  business_model: string | null
  site_type: string | null
  brand_tone: string | null
  notes: string | null
  created_at: string
}

export default async function ProjeDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select(
      'id, name, domain, sector, target_country, target_language, business_model, site_type, brand_tone, notes, created_at'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  const { data: stages } = await supabase
    .from('stages')
    .select('id, stage_name, status, started_at, completed_at')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const stageList = (stages ?? []) as Stage[]
  const activeStage = stageList.find((s) => s.status === 'active') ?? null
  const isLastStage = stageList.length > 0 && stageList.every((s) => s.status === 'completed')

  // Aktif stage için geçmiş notları server'da çek (T-02-06-04: explicit user_id filter)
  const { data: notes } = activeStage && user
    ? await supabase
        .from('audits')
        .select('id, created_at, payload')
        .eq('entity_type', 'stage')
        .eq('entity_id', activeStage.id)
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  // WordPress bağlantı durumu — Vault'tan SSR kontrolü
  const isWpConfigured = await hasWordPressCredentials(id)

  return (
    <div className="flex flex-col h-screen">
      {/* Breadcrumb + başlık */}
      <div className="p-8 pb-4">
        <Link
          href="/projeler"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← Projeler
        </Link>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{project.domain}</p>
      </div>

      {/* 2 sütunlu içerik */}
      <div className="flex flex-1 min-h-0">
        {/* Sol sütun — stage listesi */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <p className="text-xs font-normal uppercase text-muted-foreground mb-3">
            Aşamalar
          </p>
          <ul className="space-y-1">
            {stageList.map((stage) => (
              <li
                key={stage.id}
                className={cn(
                  'flex items-center justify-between py-3 px-3 rounded-md',
                  stage.status === 'active' &&
                    'border-l-2 border-blue-500 bg-blue-500/5'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {stage.status === 'completed' && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={14}
                      className="text-emerald-400 shrink-0"
                    />
                  )}
                  {stage.status === 'active' && (
                    <HugeiconsIcon
                      icon={RadioButtonIcon}
                      size={14}
                      className="text-blue-400 shrink-0"
                    />
                  )}
                  {stage.status === 'pending' && (
                    <HugeiconsIcon
                      icon={CircleIcon}
                      size={14}
                      className="text-muted-foreground shrink-0"
                    />
                  )}
                  <span
                    className={cn(
                      'text-sm truncate',
                      stage.status === 'active' &&
                        'font-semibold text-foreground',
                      stage.status === 'completed' && 'text-emerald-400',
                      stage.status === 'pending' && 'text-muted-foreground'
                    )}
                  >
                    {stage.stage_name}
                  </span>
                </div>
                <Badge
                  className={cn(
                    'ml-2 shrink-0',
                    stage.status === 'active' &&
                      'bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs',
                    stage.status === 'completed' &&
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs',
                    stage.status === 'pending' &&
                      'bg-muted text-muted-foreground border border-border text-xs'
                  )}
                >
                  {stage.status === 'active'
                    ? 'Aktif'
                    : stage.status === 'completed'
                      ? 'Tamamlandı'
                      : 'Bekliyor'}
                </Badge>
              </li>
            ))}
          </ul>
          {/* Proje araçları — Separator + nav linkleri (Phase 3+) */}
          <Separator className="my-4" />
          <Link
            href={`/projeler/${id}/rakipler`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
          >
            Rakipler
          </Link>
          <Link
            href={`/projeler/${id}/kurallar`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
          >
            Proje Kuralları
          </Link>
        </div>

        {/* Sağ sütun — aktif stage içeriği */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          {/* Proje bilgileri */}
          <div className="mb-8">
            <h2 className="text-base font-semibold mb-4">Proje Bilgileri</h2>
            <dl className="space-y-3">
              {(
                [
                  { label: 'Domain', value: project.domain },
                  { label: 'Sektör', value: project.sector },
                  { label: 'Hedef Ülke', value: project.target_country },
                  { label: 'Hedef Dil', value: project.target_language },
                  { label: 'İş Modeli', value: project.business_model },
                  { label: 'Site Tipi', value: project.site_type },
                  { label: 'Marka Tonu', value: project.brand_tone },
                ] as { label: string; value: string | null }[]
              ).map(({ label, value }) =>
                value ? (
                  <div key={label} className="flex gap-4">
                    <dt className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">
                      {label}
                    </dt>
                    <dd className="text-sm">{value}</dd>
                  </div>
                ) : null
              )}
            </dl>
          </div>

          <Separator className="mb-8" />

          {/* Notlar bölümü — aktif stage için not formu ve geçmiş notlar */}
          {activeStage && (
            <NotesSection
              stageId={activeStage.id}
              projectId={project.id}
              initialNotes={(notes ?? []) as Array<{ id: string; created_at: string; payload: { content: string } }>}
            />
          )}

          <Separator className="my-8" />

          <WordPressConnectionSection
            projectId={project.id}
            isConfigured={isWpConfigured}
          />

          <Separator className="my-8" />

          {/* Stage geçiş butonu */}
          <StageTransition
            projectId={project.id}
            activeStage={
              activeStage
                ? { id: activeStage.id, stage_name: activeStage.stage_name }
                : null
            }
            isLastStage={isLastStage}
          />
        </div>
      </div>
    </div>
  )
}
