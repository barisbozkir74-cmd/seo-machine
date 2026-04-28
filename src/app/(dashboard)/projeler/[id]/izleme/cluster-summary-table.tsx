import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ClusterMetricRow } from '@/lib/monitoring/aggregation'

function formatNumber(n: number): string {
  return n.toLocaleString('tr-TR')
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

function formatPosition(pos: number): string {
  return pos.toFixed(1)
}

export function ClusterSummaryTable({ clusters }: { clusters: ClusterMetricRow[] }) {
  if (clusters.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Bu projede henüz keyword cluster oluşturulmamış. Keyword Stratejisi sayfasından clustering başlatın.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground">Cluster</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Tıklama</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Gösterim</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">CTR</TableHead>
          <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right">Ort. Pozisyon</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clusters.map((c) => (
          <TableRow key={c.clusterId} className="hover:bg-muted/50 transition-colors">
            <TableCell className="text-sm font-medium text-foreground">{c.clusterName}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-foreground">{formatNumber(c.clicks)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-foreground">{formatNumber(c.impressions)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{formatPercent(c.ctr)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{formatPosition(c.avgPosition)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
