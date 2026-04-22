'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface RuleToggleRowProps {
  ruleKey: string
  label: string
  currentValue: boolean
  recommendedValue: boolean
  scope: 'global' | 'project'
  // toggleAction: global sayfada toggleRule, proje sayfasında toggleProjectRule.bind(null, projectId)
  toggleAction: (ruleKey: string, newValue: boolean) => Promise<{ success: boolean; error?: string }>
  // Sadece scope==='project' satırlarında mevcut
  resetAction?: () => Promise<{ success: boolean; error?: string }>
}

export function RuleToggleRow({
  ruleKey,
  label,
  currentValue,
  recommendedValue,
  scope,
  toggleAction,
  resetAction,
}: RuleToggleRowProps) {
  const [localValue, setLocalValue] = useState(currentValue)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async (checked: boolean) => {
    setIsPending(true)
    setError(null)
    const prev = localValue
    setLocalValue(checked) // optimistic update
    try {
      const result = await toggleAction(ruleKey, checked)
      if (!result.success) {
        setLocalValue(prev) // rollback
        setError(result.error ?? 'Kural güncellenemedi. Lütfen tekrar deneyin.')
      }
    } catch {
      setLocalValue(prev)
      setError('Kural güncellenemedi. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  const handleReset = async () => {
    if (!resetAction) return
    setIsPending(true)
    setError(null)
    try {
      const result = await resetAction()
      if (!result.success) {
        setError(result.error ?? 'Kural sıfırlanamadı. Lütfen tekrar deneyin.')
      }
      // Başarı: revalidatePath sayfa yeniler, scope badge Global'e döner
    } catch {
      setError('Kural sıfırlanamadı. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  const matchesRecommended = localValue === recommendedValue

  return (
    <>
      <td className="w-24 px-4 py-3">
        {scope === 'global' ? (
          <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-xs">
            Global
          </Badge>
        ) : (
          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs flex items-center gap-1 w-fit">
            Proje
            {resetAction && (
              <Button
                variant="ghost"
                size="sm"
                title="Global'e döndür"
                onClick={handleReset}
                disabled={isPending}
                className="text-blue-400 hover:text-red-400 ml-1 h-auto p-0 leading-none"
              >
                ✕
              </Button>
            )}
          </Badge>
        )}
      </td>
      <td className="flex-1 px-4 py-3">
        <span className="text-sm">{label}</span>
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </td>
      <td className="w-48 px-4 py-3">
        <span className={matchesRecommended ? 'text-xs text-muted-foreground' : 'text-xs text-amber-400'}>
          Önerilen: {recommendedValue ? 'Açık' : 'Kapalı'}
        </span>
      </td>
      <td className="w-16 px-4 py-3 text-right">
        <Switch
          checked={localValue}
          onCheckedChange={handleToggle}
          disabled={isPending}
          className={isPending ? 'opacity-50 cursor-wait' : ''}
        />
      </td>
    </>
  )
}
