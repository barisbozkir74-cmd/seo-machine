'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PanelContextItem {
  label: string
  value: string
  status?: 'ok' | 'warning' | 'missing'
}

export interface PanelAction {
  label: string
  href?: string
  description?: string
  disabled?: boolean
  disabledReason?: string
  variant?: 'default' | 'primary'
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ModuleAIPanelProps {
  title: string
  managerName?: string
  hint?: string
  badge?: string
  contextItems?: PanelContextItem[]
  nextStep?: string
  actions?: PanelAction[]
  /** sidebar: full-height right panel with tabs + chat. compact: collapsible top bar (default) */
  variant?: 'sidebar' | 'compact'
  /**
   * Unique section key for persisting task notes (e.g. 'proje-bilgileri', 'arastirma').
   * Falls back to managerName if omitted. Used as localStorage key.
   */
  section?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<NonNullable<PanelContextItem['status']>, string> = {
  ok:      'bg-emerald-400/60',
  warning: 'bg-amber-400/60',
  missing: 'bg-red-400/50',
}

const PLACEHOLDER_RESPONSE =
  'Bu özellik yakında aktif olacak. Şu an için bağlam bilgilerini ve hızlı aksiyonları kullanabilirsiniz.'

// ─── Task status types ────────────────────────────────────────────────────────

type TaskStatus = 'pending' | 'done' | 'failed' | 'approval' | 'researched'

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; text: string }> = {
  pending:    { label: 'Bekliyor',           dot: 'bg-muted-foreground/30', text: 'text-muted-foreground/50' },
  done:       { label: 'Tamamlandı',         dot: 'bg-emerald-400/70',      text: 'text-emerald-400/80' },
  failed:     { label: 'Yapılmadı',          dot: 'bg-red-400/60',          text: 'text-red-400/70' },
  approval:   { label: 'Onay Bekliyor',      dot: 'bg-amber-400/70',        text: 'text-amber-400/80' },
  researched: { label: 'Araştırma Yapıldı',  dot: 'bg-blue-400/60',         text: 'text-blue-400/70' },
}

const STATUS_ORDER: TaskStatus[] = ['pending', 'done', 'failed', 'approval', 'researched']

// ─── Tasks tab ────────────────────────────────────────────────────────────────

function TasksTab({ storageKey }: { storageKey: string }) {
  const [text, setText] = useState('')
  const [savedFeedback, setSavedFeedback] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mount'ta localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem(`tasks:${storageKey}`)
    if (saved) setText(saved)
  }, [storageKey])

  const save = useCallback(() => {
    localStorage.setItem(`tasks:${storageKey}`, text)
    setSavedFeedback(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSavedFeedback(false), 2000)
  }, [storageKey, text])

  // Ctrl/Cmd+S ile kaydet
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      save()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 p-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Bu bölüm yöneticisinin görev tanımı henüz eklenmedi.&#10;&#10;Görevleri buraya yazabilirsiniz. Her satır ayrı bir görev olarak ele alınabilir."
          className="w-full h-full resize-none bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/30 outline-none leading-relaxed"
        />
      </div>
      <div className="flex-shrink-0 border-t border-border/20 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/30 select-none">
          {savedFeedback ? '✓ Kaydedildi' : 'Ctrl+S ile kaydet'}
        </span>
        <button
          onClick={save}
          className="text-[10px] px-2.5 py-1 rounded border border-border/35 text-muted-foreground/60 hover:bg-secondary/40 transition-colors"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}

// ─── Report tab ───────────────────────────────────────────────────────────────

function ReportTab({ storageKey, managerName }: { storageKey: string; managerName?: string }) {
  const [tasks, setTasks] = useState<string[]>([])
  const [statuses, setStatuses] = useState<Record<number, TaskStatus>>({})
  const [masterApproved, setMasterApproved] = useState(false)

  // Görevler sekmesindeki metni parse et
  useEffect(() => {
    const raw = localStorage.getItem(`tasks:${storageKey}`) ?? ''
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    setTasks(lines)

    const savedStatuses = localStorage.getItem(`tasks:${storageKey}:status`)
    if (savedStatuses) {
      try { setStatuses(JSON.parse(savedStatuses)) } catch { /* ignore */ }
    }

    const approved = localStorage.getItem(`tasks:${storageKey}:master-approved`)
    setMasterApproved(approved === 'true')
  }, [storageKey])

  function setStatus(idx: number, status: TaskStatus) {
    const next = { ...statuses, [idx]: status }
    setStatuses(next)
    localStorage.setItem(`tasks:${storageKey}:status`, JSON.stringify(next))
  }

  function cycleStatus(idx: number) {
    const current = statuses[idx] ?? 'pending'
    const nextIdx = (STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length
    setStatus(idx, STATUS_ORDER[nextIdx])
  }

  function toggleMasterApproval() {
    const next = !masterApproved
    setMasterApproved(next)
    localStorage.setItem(`tasks:${storageKey}:master-approved`, String(next))
  }

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = Object.values(statuses).filter(v => v === s).length
    return acc
  }, {} as Record<TaskStatus, number>)

  const doneCount = counts.done
  const total = tasks.length

  return (
    <div className="flex flex-col h-full">

      {/* Özet şerit */}
      {total > 0 && (
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/20 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-muted-foreground/50">
            {doneCount}/{total} tamamlandı
          </span>
          {Object.entries(counts).filter(([, n]) => n > 0).map(([s, n]) => {
            const cfg = TASK_STATUS_CONFIG[s as TaskStatus]
            return (
              <span key={s} className={`flex items-center gap-1 text-[10px] ${cfg.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {n} {cfg.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Görev listesi */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
        {tasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/30 text-center pt-6 select-none px-2">
            Henüz görev yok.{' '}
            <span className="underline decoration-dotted">Görevler</span>{' '}
            sekmesine gidin ve her satıra bir görev yazın.
          </p>
        ) : (
          tasks.map((task, idx) => {
            const status = statuses[idx] ?? 'pending'
            const cfg = TASK_STATUS_CONFIG[status]
            return (
              <div key={idx}
                className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-secondary/20 group cursor-default"
              >
                {/* Durum dot — tıklayınca cycle */}
                <button
                  onClick={() => cycleStatus(idx)}
                  title={`Durum: ${cfg.label} — tıkla değiştir`}
                  className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${cfg.dot} hover:opacity-80 transition-opacity`}
                />

                {/* Görev metni */}
                <span className="flex-1 text-[11px] text-foreground/70 leading-relaxed min-w-0">
                  {task}
                </span>

                {/* Durum etiketi — select */}
                <select
                  value={status}
                  onChange={e => setStatus(idx, e.target.value as TaskStatus)}
                  className="shrink-0 bg-transparent text-[9px] text-muted-foreground/40 border-0 outline-none cursor-pointer hover:text-muted-foreground/70 transition-colors"
                  title="Durumu değiştir"
                >
                  {STATUS_ORDER.map(s => (
                    <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
            )
          })
        )}
      </div>

      {/* Master AI onay alanı */}
      <div className="flex-shrink-0 border-t border-border/20 px-4 py-3">
        <button
          onClick={toggleMasterApproval}
          className={[
            'w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-[11px] font-medium transition-colors border',
            masterApproved
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400/80'
              : 'border-border/35 bg-secondary/20 text-muted-foreground/50 hover:bg-secondary/40',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${masterApproved ? 'bg-emerald-400/70' : 'bg-muted-foreground/30'}`} />
            {masterApproved ? 'Master AI onayı verildi' : 'Master AI onayı bekleniyor'}
          </span>
          <span className="text-[9px] opacity-60">{masterApproved ? 'Kaldır' : 'Onayla'}</span>
        </button>
        {managerName && (
          <p className="text-[9px] text-muted-foreground/25 text-center mt-1.5 select-none">
            {managerName} raporu
          </p>
        )}
      </div>

    </div>
  )
}

// ─── Sidebar variant ──────────────────────────────────────────────────────────

function SidebarPanel({
  managerName,
  hint,
  badge,
  contextItems,
  nextStep,
  actions,
  section,
}: Omit<ModuleAIPanelProps, 'title' | 'variant'>) {
  const [activeTab, setActiveTab] = useState<'ai' | 'tasks' | 'report'>('ai')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const storageKey = section ?? (managerName ?? 'default').toLowerCase().replace(/\s+/g, '-')

  useEffect(() => {
    if (activeTab === 'ai') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: PLACEHOLDER_RESPONSE },
    ])
    setInput('')
  }

  function onChatKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Tab bar ── */}
      <div
        role="tablist"
        aria-label={managerName ?? 'AI Yönetici'}
        className="flex-shrink-0 flex border-b border-border/30"
      >
        {([
          { id: 'ai',     label: 'AI Yöneticisi' },
          { id: 'tasks',  label: 'Görevler' },
          { id: 'report', label: 'Biten Görevler' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex-1 py-2.5 text-[11px] font-medium transition-colors select-none',
              activeTab === tab.id
                ? 'text-foreground/80 border-b-2 border-blue-400/60 -mb-px'
                : 'text-muted-foreground/35 hover:text-muted-foreground/55',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── AI Yöneticisi sekmesi ── */}
      {activeTab === 'ai' && (
        <div className="flex flex-col flex-1 min-h-0" role="tabpanel" aria-label="AI Yöneticisi">

          {/* Bağlam ve aksiyonlar */}
          {(hint || contextItems?.length || nextStep || actions?.length) && (
            <div className="flex-shrink-0 px-4 py-3 space-y-2 border-b border-border/20">
              {hint && (
                <p className="text-[11px] text-muted-foreground/45 leading-relaxed">{hint}</p>
              )}
              {contextItems && contextItems.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {contextItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 min-w-0">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status ?? 'ok']}`} aria-hidden="true" />
                      <span className="text-[10px] text-muted-foreground/45 shrink-0 truncate">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground/65 truncate">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {nextStep && (
                <p className="text-[11px] text-muted-foreground/50 flex items-start gap-1">
                  <span aria-hidden="true" className="shrink-0 mt-px">→</span>
                  <span>{nextStep}</span>
                </p>
              )}
              {actions && actions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {actions.slice(0, 5).map((action, i) => {
                    const cls = action.variant === 'primary'
                      ? 'border border-blue-500/25 bg-blue-500/8 text-blue-400/70'
                      : 'border border-border/35 text-muted-foreground/60 hover:bg-secondary/40'
                    if (action.href && !action.disabled) {
                      return (
                        <Link key={i} href={action.href} title={action.description}
                          className={`${cls} text-[10px] px-2 py-1 rounded transition-colors`}>
                          {action.label}
                        </Link>
                      )
                    }
                    return (
                      <button key={i} disabled={action.disabled}
                        title={action.disabled ? action.disabledReason : action.description}
                        className={`${cls} text-[10px] px-2 py-1 rounded ${action.disabled ? 'opacity-30 cursor-default' : ''}`}>
                        {action.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mesajlar */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-[11px] text-muted-foreground/30 text-center pt-4 select-none">
                {managerName ? `${managerName} ile konuşmak için yazın` : 'Yöneticiye soru sorun'}
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={[
                  'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-blue-500/15 text-foreground/80'
                    : 'bg-secondary/50 text-muted-foreground/70',
                ].join(' ')}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Chat input */}
          <div className="flex-shrink-0 border-t border-border/25 p-3">
            <div className="flex items-end gap-2 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 focus-within:border-border/60 transition-colors">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder={managerName ? `${managerName} ile konuş…` : 'Sor…'}
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 resize-none leading-relaxed max-h-24 overflow-y-auto"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="flex-shrink-0 rounded-md bg-blue-500/20 text-blue-400/70 px-2 py-1 text-[11px] font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-25 disabled:cursor-default"
              >
                Gönder
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/25 text-center mt-1.5 select-none">
              Enter ile gönder · Shift+Enter yeni satır
            </p>
          </div>
        </div>
      )}

      {/* ── Görevler sekmesi ── */}
      {activeTab === 'tasks' && (
        <div className="flex-1 min-h-0" role="tabpanel" aria-label="Görevler">
          <TasksTab storageKey={storageKey} />
        </div>
      )}

      {/* ── Biten Görevler sekmesi ── */}
      {activeTab === 'report' && (
        <div className="flex-1 min-h-0" role="tabpanel" aria-label="Biten Görevler">
          <ReportTab storageKey={storageKey} managerName={managerName} />
        </div>
      )}

    </div>
  )
}

// ─── Compact variant (top-of-page, collapsible) ───────────────────────────────

function CompactPanel({
  title,
  managerName,
  hint,
  badge,
  contextItems,
  nextStep,
  actions,
}: Omit<ModuleAIPanelProps, 'variant' | 'section'>) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex-shrink-0 border-b border-border/30">
      <button
        onClick={() => setOpen(v => !v)}
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
        <span className={badge ? 'text-[10px] text-muted-foreground/25 shrink-0' : 'ml-auto text-[10px] text-muted-foreground/25 shrink-0'} aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="px-6 pb-4 pt-1 space-y-3">
          {hint && <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{hint}</p>}

          {contextItems && contextItems.length > 0 && (
            <div className="rounded-md bg-secondary/10 p-2 grid grid-cols-2 gap-1.5">
              {contextItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status ?? 'ok']}`} aria-hidden="true" />
                  <span className="text-[10px] text-muted-foreground/50 truncate shrink-0">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground/70 truncate">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {nextStep && (
            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <span aria-hidden="true">→</span>{nextStep}
            </p>
          )}

          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {actions.slice(0, 5).map((action, i) => {
                const isPrimary = action.variant === 'primary'
                const cls = isPrimary
                  ? 'border border-blue-500/30 bg-blue-500/10 text-blue-400/80'
                  : 'border border-border/40 bg-secondary/30 text-muted-foreground/70 hover:bg-secondary/50'
                if (action.href && !action.disabled) {
                  return (
                    <Link key={i} href={action.href} title={action.description}
                      className={`${cls} text-[11px] px-2.5 py-1.5 rounded-md transition-colors`}>
                      {action.label}
                    </Link>
                  )
                }
                return (
                  <button key={i} disabled={action.disabled}
                    title={action.disabled ? action.disabledReason : action.description}
                    className={`${cls} text-[11px] px-2.5 py-1.5 rounded-md ${action.disabled ? 'opacity-40 cursor-default pointer-events-none' : ''} transition-colors`}>
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

// ─── Export ───────────────────────────────────────────────────────────────────

export function ModuleAIPanel({ variant = 'compact', ...props }: ModuleAIPanelProps) {
  if (variant === 'sidebar') {
    return <SidebarPanel {...props} />
  }
  return <CompactPanel {...props} />
}
