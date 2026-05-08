import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectNav } from '../ProjectNav'
import { ResearchSection, type ColumnConfig } from './ResearchSection'
import { ResearchRerunButton } from './ResearchRerunButton'
import type { SectionKey } from './actions'

// ─── Bölüm konfigürasyonları ─────────────────────────────────────────────────

type SectionConfig = {
  section: SectionKey
  title: string
  columns: ColumnConfig[]
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    section: 'market_structures',
    title: 'Pazarda Öne Çıkan Yapılar',
    columns: [
      { key: 'alan', label: 'Alan', placeholder: 'İçerik alanı' },
      { key: 'aciklama', label: 'Açıklama', placeholder: 'Kısa açıklama' },
      { key: 'onem', label: 'Önem', placeholder: 'yüksek / orta / düşük' },
    ],
  },
  {
    section: 'competitor_strengths',
    title: 'Rakiplerin Güçlü Olduğu Alanlar',
    columns: [
      { key: 'alan', label: 'Alan', placeholder: 'İçerik alanı' },
      { key: 'neden_guclu', label: 'Neden Güçlü', placeholder: 'Gerekçe' },
      { key: 'seviye', label: 'Seviye', placeholder: 'yüksek / orta / düşük' },
    ],
  },
  {
    section: 'competitor_weaknesses',
    title: 'Rakiplerin Zayıf Olduğu Alanlar',
    columns: [
      { key: 'alan', label: 'Alan', placeholder: 'İçerik alanı' },
      { key: 'zayiflik', label: 'Zayıflık', placeholder: 'Zayıflık açıklaması' },
      { key: 'firsat_notu', label: 'Fırsat Notu', placeholder: 'Değerlendirme' },
    ],
  },
  {
    section: 'quick_wins',
    title: 'Hızlı Girilebilecek Boşluklar',
    columns: [
      { key: 'keyword_alan', label: 'Keyword / Alan', placeholder: 'Keyword veya alan' },
      { key: 'zorluk', label: 'Zorluk', placeholder: 'Düşük / Orta / Yüksek' },
      { key: 'tahmini_etki', label: 'Tahmini Etki', placeholder: 'Beklenen kazanım' },
    ],
  },
  {
    section: 'high_value_opportunities',
    title: 'Ticari Değeri Yüksek Sayfa Fırsatları',
    columns: [
      { key: 'sayfa_alan', label: 'Sayfa / Alan', placeholder: 'Sayfa türü veya alan' },
      { key: 'ticari_deger', label: 'Ticari Değer', placeholder: 'Yüksek / Orta / Düşük' },
      { key: 'oncelik', label: 'Öncelik', placeholder: '1 / 2 / 3' },
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArastirmaPage({
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
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Tüm bölümleri tek sorguda çek
  const { data: reports } = await supabase
    .from('research_reports')
    .select('section, rows')
    .eq('project_id', id)
    .eq('user_id', user.id)

  // section → rows haritası
  const rowsMap: Partial<Record<SectionKey, Record<string, string>[]>> = {}
  for (const report of reports ?? []) {
    rowsMap[report.section as SectionKey] =
      (report.rows as Record<string, string>[]) ?? []
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
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Araştırma</h1>
          <ResearchRerunButton projectId={id} userId={user.id} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/arastirma`} />
        </div>

        {/* Sağ içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-10">
          {SECTION_CONFIGS.map((config) => (
            <ResearchSection
              key={config.section}
              projectId={id}
              section={config.section}
              title={config.title}
              columns={config.columns}
              initialRows={rowsMap[config.section] ?? []}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
