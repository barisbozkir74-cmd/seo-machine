import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasWordPressCredentials } from '@/lib/supabase/vault'
import { WordPressConnectionSection } from '@/app/(dashboard)/projeler/[id]/wordpress-section'
import { GscConnectionSection } from '@/app/(dashboard)/projeler/[id]/gsc-section'

function PlannedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Planlanan
    </span>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </p>
  )
}

export default async function SettingsIntegrationsPage({
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
    .select('id, name, gsc_property_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const isWpConfigured = await hasWordPressCredentials(id)

  const isGscConnected =
    project.gsc_property_url !== null && (project.gsc_property_url as string) !== ''

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Entegrasyonlar</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-8">

        {/* ── Aktif ── */}
        <section>
          <SectionHeading>Aktif</SectionHeading>
          <div className="space-y-4">

            {/* WordPress */}
            <div className="rounded-lg border border-border p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">WordPress</p>
                <p className="text-xs text-muted-foreground mt-0.5">REST API üzerinden içerik yayınlama</p>
              </div>
              <WordPressConnectionSection projectId={id} isConfigured={isWpConfigured} />
            </div>

            {/* Google Search Console */}
            <div className="rounded-lg border border-border p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">Google Search Console</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trafik ve sıralama verilerini izleme modülüne bağlayın
                </p>
              </div>
              <GscConnectionSection
                projectId={id}
                userId={user.id}
                isConnected={isGscConnected}
                gscPropertyUrl={project.gsc_property_url as string | null}
              />
            </div>

          </div>
        </section>

        {/* ── Yakında ── */}
        <section>
          <SectionHeading>Yakında</SectionHeading>
          <div className="space-y-4">

            {/* Google Analytics 4 */}
            <div className="rounded-lg border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* GA4 logo area */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold text-muted-foreground">
                    GA4
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Google Analytics</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Trafik verileri, dönüşüm izleme ve sayfa performansı
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <span className="text-xs text-muted-foreground">Henüz bağlı değil</span>
                  <div title="Yakında" className="cursor-not-allowed">
                    <button
                      disabled
                      className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
                    >
                      Bağla
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Business Profile */}
            <div className="rounded-lg border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold text-muted-foreground">
                    GBP
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Google Business Profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Yerel arama görünürlüğü ve müşteri yorumları
                    </p>
                  </div>
                </div>
                <PlannedBadge />
              </div>
            </div>

            {/* Google Merchant Center */}
            <div className="rounded-lg border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold text-muted-foreground">
                    MC
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Google Merchant Center</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ürün feed&apos;i ve Shopping reklamları
                    </p>
                  </div>
                </div>
                <PlannedBadge />
              </div>
            </div>

            {/* Google Tag Manager */}
            <div className="rounded-lg border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold text-muted-foreground">
                    GTM
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tag Manager</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Etkinlik izleme ve dönüşüm takibi
                    </p>
                  </div>
                </div>
                <PlannedBadge />
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}
