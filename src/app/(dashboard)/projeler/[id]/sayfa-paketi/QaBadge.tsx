'use client'

import { cn } from '@/lib/utils'

type QaRule = {
  id: string
  severity: 'warning' | 'error'
}

export type { QaRule }

type ProjectRules = Record<string, boolean>

export type QaBadgeProps = {
  seoTitle: string
  metaDescription: string
  h1: string
  focusKeyword: string | null
  slug: string | null
  projectRules: ProjectRules
}

export function computeQaRules(props: QaBadgeProps): QaRule[] {
  const rules: QaRule[] = []

  // QA-01: SEO Title uzunluğu — title_max_length_enforced proje kuralı aktifse atlanır (çift ceza önlenir)
  if (!props.projectRules['title_max_length_enforced']) {
    if (props.seoTitle.length > 70) {
      rules.push({ id: 'QA-01', severity: 'error' })
    } else if (props.seoTitle.length > 60) {
      rules.push({ id: 'QA-01', severity: 'warning' })
    }
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

  // Rules Engine entegrasyonu — yalnızca aktif kurallar değerlendirilir
  if (props.projectRules['title_starts_with_keyword'] && props.focusKeyword) {
    if (!props.seoTitle.toLowerCase().startsWith(props.focusKeyword.toLowerCase())) {
      rules.push({ id: 'title_starts_with_keyword', severity: 'warning' })
    }
  }

  if (props.projectRules['title_max_length_enforced']) {
    if (props.seoTitle.length > 60) {
      rules.push({ id: 'title_max_length_enforced', severity: 'error' })
    }
  }

  // title_includes_brand: client context'te brand name mevcut değil — no-op
  // h1_single_per_page: DOM H1 sayısı client'ta kontrol edilemez — no-op

  if (props.projectRules['h1_includes_keyword'] && props.focusKeyword) {
    if (!props.h1.toLowerCase().includes(props.focusKeyword.toLowerCase())) {
      rules.push({ id: 'h1_includes_keyword', severity: 'warning' })
    }
  }

  if (props.projectRules['h1_exact_match'] && props.focusKeyword) {
    if (props.h1.toLowerCase() !== props.focusKeyword.toLowerCase()) {
      rules.push({ id: 'h1_exact_match', severity: 'warning' })
    }
  }

  if (props.projectRules['slug_lowercase_hyphen'] && props.slug) {
    if (!/^[a-z0-9-]+$/.test(props.slug)) {
      rules.push({ id: 'slug_lowercase_hyphen', severity: 'error' })
    }
  }

  if (props.projectRules['meta_desc_includes_keyword'] && props.focusKeyword) {
    if (!props.metaDescription.toLowerCase().includes(props.focusKeyword.toLowerCase())) {
      rules.push({ id: 'meta_desc_includes_keyword', severity: 'warning' })
    }
  }

  if (props.projectRules['meta_desc_required']) {
    if (!props.metaDescription.trim()) {
      rules.push({ id: 'meta_desc_required', severity: 'error' })
    }
  }

  if (props.projectRules['meta_desc_length_enforced']) {
    const len = props.metaDescription.length
    if (len > 0 && (len > 160 || len < 120)) {
      rules.push({ id: 'meta_desc_length_enforced', severity: 'warning' })
    }
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
