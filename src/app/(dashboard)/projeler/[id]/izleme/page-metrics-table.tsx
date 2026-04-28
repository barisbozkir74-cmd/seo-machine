import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PageMetricRow } from '@/lib/monitoring/aggregation'

function formatNumber(n: number): string {
  return n.toLocaleString('tr-TR')
}

function formatPosition(pos: number): string {
  return pos.toFixed(1)
}

function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta.toFixed(1)}`
  return delta.toFixed(1)
}

export function PageMetricsTable({ pages }: { pages: PageMetricRow[] }) {
  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">GSC verisi bulunamadı</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground">Sayfa</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Tıklama</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Gösterim</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Ort. Pozisyon</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Değişim</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground">Durum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.map((p) => (
          <TableRow key={p.pageId} className="hover:bg-muted/50 transition-colors">
            <TableCell>
              <span
                className="text-sm text-muted-foreground truncate max-w-[240px] block"
                title={p.pageUrl}
              >
                {p.pageUrl}
              </span>
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums text-foreground">{formatNumber(p.clicks)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-foreground">{formatNumber(p.impressions)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{formatPosition(p.avgPosition)}</TableCell>
            <TableCell className={cn(
              'text-right text-sm tabular-nums',
              p.deltaPosition === null ? 'text-muted-foreground' :
              p.deltaPosition > 0 ? 'text-red-400' :
              p.deltaPosition < 0 ? 'text-emerald-400' :
              'text-muted-foreground'
            )}>
              {formatDelta(p.deltaPosition)}
            </TableCell>
            <TableCell>
              {p.isDecayed ? (
                <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs rounded-full px-2 py-0.5">
                  Düşüş
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
