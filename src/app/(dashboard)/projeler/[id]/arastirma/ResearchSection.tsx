import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type ColumnConfig = {
  key: string
  label: string
  placeholder?: string
}

type Props = {
  projectId: string
  section: string
  title: string
  columns: ColumnConfig[]
  initialRows: Record<string, string>[]
}

export function ResearchSection({ title, columns, initialRows }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-sm text-muted-foreground py-6"
                >
                  Henüz veri yok. Araştırmayı başlatın.
                </TableCell>
              </TableRow>
            ) : (
              initialRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="py-2 px-4 text-sm">
                      {row[col.key] ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
