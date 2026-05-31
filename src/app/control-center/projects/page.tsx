import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { NewProjectModal } from '@/app/(dashboard)/projeler/new-project-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DeleteProjectButton } from './DeleteProjectButton'

type Project = {
  id:         string
  name:       string
  domain:     string | null
  sector:     string | null
  created_at: string
  research_approved:         boolean
  keyword_strategy_approved: boolean
  blueprint_approved:        boolean
}

function projectPhase(p: Project): { label: string; color: string } {
  if (p.blueprint_approved)        return { label: 'İçerik',    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }
  if (p.keyword_strategy_approved) return { label: 'Mimari',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
  if (p.research_approved)         return { label: 'Strateji',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  return                                  { label: 'Araştırma', color: 'text-muted-foreground bg-secondary border-border/50' }
}

function nextStepLabel(p: Project): string {
  if (!p.research_approved)         return 'Araştırmayı tamamla'
  if (!p.keyword_strategy_approved) return 'Strateji onayını tamamla'
  if (!p.blueprint_approved)        return "Blueprint'i hazırla"
  return 'İçerik üretimi aktif'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day:   'numeric',
    month: 'short',
  })
}

function GateBar({ project }: { project: Project }) {
  const gates = [
    project.research_approved,
    project.keyword_strategy_approved,
    project.blueprint_approved,
  ]
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {gates.map((done, i) => (
        <span
          key={i}
          className={cn(
            'h-1 w-5 rounded-full transition-colors',
            done ? 'bg-emerald-400/60' : 'bg-border/60',
          )}
        />
      ))}
    </div>
  )
}

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id, name, domain, sector, created_at,
      research_approved, keyword_strategy_approved, blueprint_approved
    `)
    .order('created_at', { ascending: false })

  const list = (projects ?? []) as Project[]

  const projectIds = list.map((p) => p.id)
  const pagesCountMap = new Map<string, number>()

  if (projectIds.length > 0) {
    const { data: allPages } = await supabase
      .from('pages')
      .select('project_id')
      .in('project_id', projectIds)

    for (const p of (allPages ?? []) as Array<{ project_id: string }>) {
      pagesCountMap.set(p.project_id, (pagesCountMap.get(p.project_id) ?? 0) + 1)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Projeler</h1>
          {list.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">{list.length} proje</p>
          )}
        </div>
        <NewProjectModal>
          <Button size="sm">Yeni Proje</Button>
        </NewProjectModal>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Projeler yüklenemedi. Sayfayı yenileyin.
        </p>
      )}

      {!error && list.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 py-20 gap-3">
          <p className="text-sm font-medium text-foreground">Henüz proje yok</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            İlk projenizi oluşturun ve SEO iş akışını başlatın.
          </p>
          <div className="mt-1">
            <NewProjectModal>
              <Button size="sm">Yeni Proje Oluştur</Button>
            </NewProjectModal>
          </div>
        </div>
      )}

      {list.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((project) => {
            const phase = projectPhase(project)
            const pages = pagesCountMap.get(project.id) ?? 0

            return (
              <li key={project.id} className="flex flex-col rounded-lg border border-border/50 bg-background transition-colors hover:border-border hover:bg-secondary/20">
                <Link
                  href={`/control-center/projects/${project.id}`}
                  className="group flex flex-col gap-3 p-4"
                >
                  {/* Name + phase */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {project.name}
                      </p>
                      {project.domain && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {project.domain}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'flex-shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium',
                      phase.color,
                    )}>
                      {phase.label}
                    </span>
                  </div>

                  {/* Gate progress + page count */}
                  <div className="flex items-center justify-between">
                    <GateBar project={project} />
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                      {pages > 0 ? `${pages} sayfa` : formatDate(project.created_at)}
                    </span>
                  </div>

                  {/* Next step */}
                  <p className="text-[11px] text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
                    {nextStepLabel(project)} →
                  </p>
                </Link>

                {/* Actions row */}
                <div className="flex items-center justify-end gap-1 border-t border-border/30 px-3 py-1.5">
                  <Link
                    href={`/control-center/projects/${project.id}/settings/info`}
                    title="Düzenle"
                    aria-label="Projeyi düzenle"
                    className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors rounded"
                  >
                    {/* Pencil icon — inline SVG */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                  <DeleteProjectButton projectId={project.id} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
