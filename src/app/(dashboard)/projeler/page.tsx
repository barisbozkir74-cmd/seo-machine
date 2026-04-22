import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { NewProjectModal } from './new-project-modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Stage = {
  stage_name: string
  status: string
}

type Project = {
  id: string
  name: string
  domain: string | null
  sector: string | null
  created_at: string
  stages: Stage[]
}

export default async function ProjelerPage() {
  const supabase = await createClient()

  const { data: projeler, error } = await supabase
    .from('projects')
    .select('id, name, domain, sector, created_at, stages(stage_name, status)')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Projeler</h1>
          <NewProjectModal>
            <Button>Yeni Proje Oluştur</Button>
          </NewProjectModal>
        </div>
        <p className="text-sm text-muted-foreground">
          Projeler yüklenemedi. Lütfen sayfayı yenileyin.
        </p>
      </main>
    )
  }

  const projelerListesi = (projeler ?? []) as Project[]

  function getAktifStageName(stages: Stage[]): string {
    return stages.find((s) => s.status === 'active')?.stage_name ?? '—'
  }

  function getDurum(stages: Stage[]): 'Aktif' | 'Tamamlandı' {
    if (stages.length === 0) return 'Aktif'
    const hepsiTamamlandi = stages.every((s) => s.status === 'completed')
    return hepsiTamamlandi ? 'Tamamlandı' : 'Aktif'
  }

  function formatTarih(tarih: string): string {
    return new Date(tarih).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Projeler</h1>
        <NewProjectModal>
          <Button>Yeni Proje Oluştur</Button>
        </NewProjectModal>
      </div>

      {projelerListesi.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <p className="text-xl font-semibold">Henüz proje yok</p>
          <p className="text-sm text-muted-foreground">
            Ajansınızın ilk projesini oluşturun ve stage bazlı takibe başlayın.
          </p>
          <NewProjectModal>
            <Button>Yeni Proje Oluştur</Button>
          </NewProjectModal>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                Proje Adı
              </TableHead>
              <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                Domain
              </TableHead>
              <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                Sektör
              </TableHead>
              <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                Aktif Stage
              </TableHead>
              <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                Durum
              </TableHead>
              <TableHead className="text-xs font-normal uppercase text-muted-foreground">
                Oluşturulma
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projelerListesi.map((proje) => {
              const durum = getDurum(proje.stages)
              return (
                <TableRow
                  key={proje.id}
                  className="hover:bg-secondary cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/projeler/${proje.id}`}
                      className="hover:underline font-medium"
                    >
                      {proje.name}
                    </Link>
                  </TableCell>
                  <TableCell>{proje.domain ?? '—'}</TableCell>
                  <TableCell>{proje.sector ?? '—'}</TableCell>
                  <TableCell>{getAktifStageName(proje.stages)}</TableCell>
                  <TableCell>
                    {durum === 'Aktif' ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Tamamlandı
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatTarih(proje.created_at)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </main>
  )
}
