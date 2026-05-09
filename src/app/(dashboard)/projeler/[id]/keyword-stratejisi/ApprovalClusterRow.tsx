'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}

interface ApprovalClusterRowProps {
  cluster: {
    id: string
    cluster_name: string
    intent: string | null
    status: string
    keyword_count: number
    total_volume: number
  }
  isSelected: boolean
  isPending: boolean
  onSelect: () => void
  onApprove: () => void
  onReject: () => void
  onRename: (name: string) => void
}

export function ApprovalClusterRow({
  cluster,
  isSelected,
  isPending,
  onSelect,
  onApprove,
  onReject,
  onRename,
}: ApprovalClusterRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(cluster.cluster_name)
  const [nameError, setNameError] = useState(false)

  const saveClusterName = () => {
    if (!editValue.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    setIsEditing(false)
    if (editValue.trim() !== cluster.cluster_name) {
      onRename(editValue.trim())
    }
  }

  const cancelEdit = () => {
    setEditValue(cluster.cluster_name)
    setNameError(false)
    setIsEditing(false)
  }

  return (
    <div
      className={`flex flex-col gap-1 px-3 py-3 border-b border-border/50 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-secondary/40'
          : 'hover:bg-secondary/20'
      } ${isPending ? 'pointer-events-none opacity-70' : ''}`}
      onClick={onSelect}
    >
      {/* Birinci satır: status dot + isim + meta */}
      <div className="flex items-center gap-2 min-w-0">
        <StatusBadge status={cluster.status} />
        {isEditing ? (
          <input
            autoFocus
            className={`flex-1 h-6 bg-transparent border-0 border-b text-sm font-semibold focus:outline-none px-0 ${
              nameError ? 'border-destructive' : 'border-border focus:border-foreground'
            }`}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); setNameError(false) }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') saveClusterName()
              if (e.key === 'Escape') cancelEdit()
            }}
            onBlur={saveClusterName}
            onClick={(e) => e.stopPropagation()}
            title={nameError ? 'Küme adı boş bırakılamaz' : undefined}
          />
        ) : (
          <span
            className="text-sm font-semibold truncate flex-1 cursor-text"
            onDoubleClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
          >
            {cluster.cluster_name}
          </span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {cluster.keyword_count} kw · {formatVolume(cluster.total_volume)} vol
        </span>
      </div>

      {/* İkinci satır: aksiyon butonları */}
      {/* D-03: Durum tablosu — hangi buton görünür (UI-SPEC) */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {cluster.status !== 'approved' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            onClick={onApprove}
            disabled={isPending}
          >
            Onayla ✓
          </Button>
        )}
        {cluster.status !== 'rejected' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={onReject}
            disabled={isPending}
          >
            Reddet ✗
          </Button>
        )}
      </div>
    </div>
  )
}
