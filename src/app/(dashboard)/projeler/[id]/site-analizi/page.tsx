import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { flattenImportedTree, type ImportedPage } from '@/lib/wp/normalize'
import { ProjectNav } from '../ProjectNav'
import { ImportedPageTree } from './ImportedPageTree'

export default async function SiteAnaliziPage({
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
    .select('id, name, import_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const importDone =
    project.import_status !== null &&
    project.import_status !== 'idle' &&
    project.import_status !== 'running' &&
    project.import_status !== 'enriching'

  const importRunning =
    project.import_status === 'running' || project.import_status === 'enriching'

  const importNever =
    project.import_status === null || project.import_status === 'idle'

  // Sayfaları yalnızca import tamamlandığında çek
  let flattenedPages: ReturnType<typeof flattenImportedTree> = []
  if (importDone) {
    const { data: importedPages } = await supabase
      .from('project_imported_pages')
      .select(`
        wp_id, wp_type, title, slug, link, parent_wp_id,
        wp_modified_at, content_summary, primary_intent,
        gsc_clicks, gsc_impressions, gsc_avg_position,
        flag_orphan, flag_weak_page, flag_outdated,
        flag_missing_metadata, flag_missing_keyword, flag_duplicate_intent
      `)
      .eq('project_id', id)
      .order('wp_id', { ascending: true })

    flattenedPages = flattenImportedTree((importedPages ?? []) as ImportedPage[])
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Site Analizi</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/site-analizi`} />
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          {importNever && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-base font-semibold">Henüz içerik aktarılmadı</p>
              <p className="text-sm text-muted-foreground mt-2">
                WordPress sitenizin içeriğini içe aktararak SEO denetimini başlatın.
              </p>
              <Link
                href={`/projeler/${id}`}
                className="inline-flex items-center mt-4 text-sm text-foreground hover:underline"
              >
                WordPress Sitemi İçeri Al →
              </Link>
            </div>
          )}

          {importRunning && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">İçe aktarma devam ediyor...</p>
            </div>
          )}

          {importDone && (
            <ImportedPageTree pages={flattenedPages} />
          )}
        </div>
      </div>
    </div>
  )
}
