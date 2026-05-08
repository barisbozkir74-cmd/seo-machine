'use client'

import { useTransition } from 'react'
import { updateClusterRevenue } from './actions'

const REVENUE_OPTIONS = [
  { value: 'bilgi',  label: 'Bilgi' },
  { value: 'mixed',  label: 'Mixed' },
  { value: 'ticari', label: 'Ticari' },
] as const

export function RevenueOverrideSelect({
  clusterId,
  projectId,
  currentRevenue,
}: {
  clusterId: string
  projectId: string
  currentRevenue: string | null
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newValue = e.target.value
    if (!newValue) return
    startTransition(async () => {
      await updateClusterRevenue(clusterId, newValue, projectId)
    })
  }

  return (
    <select
      value={currentRevenue ?? ''}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Gelir tipi seç"
      className="bg-transparent text-xs text-muted-foreground cursor-pointer border-0 outline-none focus:ring-0 min-w-[80px] disabled:opacity-50"
    >
      <option value="" disabled>Tür seç</option>
      {REVENUE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
