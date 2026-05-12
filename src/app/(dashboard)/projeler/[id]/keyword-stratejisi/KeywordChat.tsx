'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'Hangi kümeye önce içerik üretmeliyim?',
  'Uzun kuyruk fırsatları neler?',
  'En yüksek gelir potansiyeli hangi kümede?',
  'Hangi keywordler çok rekabetçi?',
]

export function KeywordChat({
  projectId,
  collapsed,
  onToggle,
}: {
  projectId: string
  collapsed: boolean
  onToggle: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // D-01: İlk yüklemede analiz yapılmamışsa otomatik tetikle
  useEffect(() => {
    const stored = localStorage.getItem(`kwai_analyzed_${projectId}`)
    if (!stored) {
      runAnalysis()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantId = crypto.randomUUID()

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setInput('')
    setIsStreaming(true)

    try {
      const res = await fetch('/api/keywords/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: 'Hata oluştu. Tekrar deneyin.' } : m
          )
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snap = accumulated
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m))
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Bağlantı hatası.' } : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const runAnalysis = async () => {
    if (isStreaming) return

    const primaryId = crypto.randomUUID()
    const reviewId = crypto.randomUUID()

    // Primary AI için placeholder mesaj ekle
    setMessages([{ id: primaryId, role: 'assistant', content: '' }])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/keywords/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok || !res.body) {
        setMessages([{
          id: primaryId,
          role: 'assistant',
          content: 'Analiz başarısız oldu. Stratejiyi Yenile butonuna tıklayarak tekrar dene.',
        }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let inReview = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        if (!inReview && accumulated.includes('__REVIEW_START__')) {
          // Primary bitti — Review mesajını state'e ekle
          const primaryContent = accumulated.split('__REVIEW_START__')[0]
          setMessages([
            { id: primaryId, role: 'assistant', content: primaryContent },
            { id: reviewId, role: 'assistant', content: '' },
          ])
          accumulated = accumulated.split('__REVIEW_START__')[1] ?? ''
          inReview = true
        } else if (inReview) {
          const snap = accumulated
          setMessages((prev) =>
            prev.map((m) =>
              m.id === reviewId ? { ...m, content: 'Denetim: ' + snap } : m
            )
          )
        } else {
          const snap = accumulated
          setMessages((prev) =>
            prev.map((m) => (m.id === primaryId ? { ...m, content: snap } : m))
          )
        }
      }

      // D-01: Başarılı analiz timestamp'ini kaydet
      localStorage.setItem(`kwai_analyzed_${projectId}`, new Date().toISOString())
    } catch {
      setMessages([{
        id: primaryId,
        role: 'assistant',
        content: 'Analiz başarısız oldu. Stratejiyi Yenile butonuna tıklayarak tekrar dene.',
      }])
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-l border-border flex flex-col items-center pt-3 gap-2">
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="AI Chat'i aç"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <span className="text-xs text-muted-foreground [writing-mode:vertical-rl] rotate-180 select-none mt-1">
          AI Asistan
        </span>
      </div>
    )
  }

  return (
    <div className="w-80 shrink-0 border-l border-border flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-medium">AI Asistan</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Stratejiyi Yenile — UI-SPEC: violet-400 + spinner on loading */}
          <button
            onClick={() => { setMessages([]); runAnalysis() }}
            disabled={isStreaming}
            title="Stratejiyi yeniden analiz et"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50 px-2 py-0.5 shrink-0"
          >
            {isStreaming ? (
              <span className="inline-flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analiz ediliyor...
              </span>
            ) : 'Stratejiyi Yenile'}
          </button>
          {/* Collapse butonu — değişmez */}
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Daralt"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center pt-2">
              Keyword stratejin hakkında soru sor.
            </p>
            <div className="space-y-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={isStreaming}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-md border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                msg.role === 'user'
                  ? 'max-w-[85%] bg-primary text-primary-foreground text-xs px-3 py-2 rounded-xl rounded-br-sm'
                  : 'max-w-[90%] text-xs text-foreground leading-relaxed'
              }
            >
              {msg.role === 'assistant' && msg.content === '' ? (
                <span className="inline-flex gap-1 items-center text-muted-foreground">
                  <span className="animate-bounce [animation-delay:0ms]">·</span>
                  <span className="animate-bounce [animation-delay:150ms]">·</span>
                  <span className="animate-bounce [animation-delay:300ms]">·</span>
                </span>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border shrink-0">
        <div className="flex items-end gap-1.5 rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring px-2 py-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj yaz... (Enter gönder)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none max-h-24 disabled:opacity-50"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors pb-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-1">Shift+Enter yeni satır</p>
      </div>
    </div>
  )
}
