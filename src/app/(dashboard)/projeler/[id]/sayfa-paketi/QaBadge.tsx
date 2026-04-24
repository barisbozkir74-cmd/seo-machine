'use client'

import { cn } from '@/lib/utils'

type QaRule = {
  id: string
  severity: 'warning' | 'error'
}

export type QaBadgeProps = {
  seoTitle: string
  metaDescription: string
  h1: string
  focusKeyword: string | null
}

function computeQaRules(props: QaBadgeProps): QaRule[] {
  const rules: QaRule[] = []

  // QA-01: SEO Title uzunluğu
  if (props.seoTitle.length > 70) {
    rules.push({ id: 'QA-01', severity: 'error' })
  } else if (props.seoTitle.length > 60) {
    rules.push({ id: 'QA-01', severity: 'warning' })
  }

  // QA-02: Meta Description uzunluğu
  if (props.metaDescription.length > 170) {
    rules.push({ id: 'QA-02', severity: 'error' })
  } else if (props.metaDescription.length > 155) {
    rules.push({ id: 'QA-02', severity: 'warning' })
  }

  // QA-03: H1 dolu mu
  if (!props.h1.trim()) {
    rules.push({ id: 'QA-03', severity: 'error' })
  }

  // QA-04: Focus keyword SEO title'da var mı
  if (
    props.focusKeyword &&
    !props.seoTitle.toLowerCase().includes(props.focusKeyword.toLowerCase())
  ) {
    rules.push({ id: 'QA-04', severity: 'warning' })
  }

  return rules
}

export function QaBadge(props: QaBadgeProps) {
  const rules = computeQaRules(props)
  const errors = rules.filter((r) => r.severity === 'error')
  const warnings = rules.filter((r) => r.severity === 'warning')

  if (errors.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-red-400')}>
        ✕ Hata
      </span>
    )
  }

  if (warnings.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-amber-400')}>
        ⚠ {warnings.length} Uyarı
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-emerald-400')}>
      ✓ QA Geçti
    </span>
  )
}
