'use client'

import { useState } from 'react'
import Link from 'next/link'

interface PanelContextItem {
  label: string
  value: string
  status?: 'ok' | 'warning' | 'missing'
}

interface PanelAction {
  label: string
  href?: string
  description?: string
  disabled?: boolean
  disabledReason?: string
  variant?: 'default' | 'primary'
}

interface ModuleAIPanelProps {
  title: string
  managerName?: string
  hint?: string
  badge?: string
  contextItems?: PanelContextItem[]
  nextStep?: string
  actions?: PanelAction[]
}

const STATUS_DOT: Record<NonNullable<PanelContextItem['status']>, string> = {
  ok: 'bg-emerald-400/60',
  warning: 'bg-amber-400/60',
  missing: 'bg-red-400/50',
}

export function ModuleAIPanel({
  title,
  managerName,
  hint,
  badge,
  contextItems,
  nextStep,
  actions,
}: ModuleAIPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex-shrink-0 border-b border-border/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-secondary/20 transition-colors text-left"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400/60 shrink-0" aria-hidden="true" />
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 select-none shrink-0">
          AI Yönetici
        </span>
        {managerName ? (
          <span className="text-[11px] font-medium text-blue-400/70 truncate">{managerName}</span>
        ) : (
          <span className="text-xs text-muted-foreground/60 truncate">{title}</span>
        )}
        {badge && (
          <span className="ml-auto mr-2 flex-shrink-0 rounded border border-border/40 bg-secondary/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/50 select-none">
            {badge}
          </span>
        )}
        <span
          className={badge ? 'text-[10px] text-muted-foreground/25 shrink-0' : 'ml-auto text-[10px] text-muted-foreground/25 shrink-0'}
          aria-hidden="true"
        >
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="bg-secondary/5 px-6 pb-4 pt-1 space-y-3">
          {managerName && (
            <p className="text-[10px] text-muted-foreground/40 select-none">
              {title}
            </p>
          )}
          {hint && (
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{hint}</p>
          )}

          {contextItems && contextItems.length > 0 && (
            <div className="bg-secondary/10 rounded-md p-2 grid grid-cols-2 gap-1.5">
              {contextItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status ?? 'ok']}`}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] text-muted-foreground/50 truncate shrink-0">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 truncate">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {nextStep && (
            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <span aria-hidden="true">→</span>
              {nextStep}
            </p>
          )}

          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {actions.slice(0, 5).map((action, i) => {
                const isPrimary = action.variant === 'primary'
                const baseClass = isPrimary
                  ? 'border border-blue-500/30 bg-blue-500/10 text-blue-400/80'
                  : 'border border-border/40 bg-secondary/30 text-muted-foreground/70 hover:bg-secondary/50'
                const sizeClass = 'text-[11px] px-2.5 py-1.5 rounded-md'
                const disabledClass = action.disabled ? 'opacity-40 cursor-default pointer-events-none' : ''

                if (action.href && !action.disabled) {
                  return (
                    <Link
                      key={i}
                      href={action.href}
                      title={action.description}
                      className={`${baseClass} ${sizeClass} transition-colors`}
                    >
                      {action.label}
                    </Link>
                  )
                }

                return (
                  <button
                    key={i}
                    disabled={action.disabled}
                    title={action.disabled ? action.disabledReason : action.description}
                    className={`${baseClass} ${sizeClass} ${disabledClass} transition-colors`}
                  >
                    {action.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-4 py-3 focus-within:border-border/80 transition-colors">
            <input
              type="text"
              placeholder={managerName ? `${managerName} ile konuş…` : 'Yöneticiye sor…'}
              disabled
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 disabled:cursor-default"
            />
            <span className="text-[10px] text-muted-foreground/30 shrink-0 select-none whitespace-nowrap">
              Yakında aktif
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
