'use client'

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'

interface SplitPaneProps {
  /** Sol panel içeriği */
  children: ReactNode
  /** Sağ panel içeriği */
  right: ReactNode
  /** Sağ panel varsayılan genişliği (px) */
  defaultRightWidth?: number
  minRightWidth?: number
  maxRightWidth?: number
  /** localStorage'da saklamak için benzersiz anahtar */
  storageKey?: string
}

export function SplitPane({
  children,
  right,
  defaultRightWidth = 288,
  minRightWidth = 180,
  maxRightWidth = 540,
  storageKey,
}: SplitPaneProps) {
  const [rightWidth, setRightWidth] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`split-pane:${storageKey}`)
      if (saved) {
        const n = parseInt(saved, 10)
        if (!isNaN(n)) return n
      }
    }
    return defaultRightWidth
  })

  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // localStorage'a yaz
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`split-pane:${storageKey}`, String(rightWidth))
    }
  }, [rightWidth, storageKey])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    // Sola gidince sağ panel genişler, sağa gidince daralır
    const delta = startX.current - e.clientX
    const next = Math.max(minRightWidth, Math.min(maxRightWidth, startWidth.current + delta))
    setRightWidth(next)
  }, [minRightWidth, maxRightWidth])

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = rightWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Çift tıklayınca varsayılan genişliğe sıfırla
  function onHandleDoubleClick() {
    setRightWidth(defaultRightWidth)
  }

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 min-w-0">

      {/* Sol panel */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>

      {/* Sürüklenebilir ayraç */}
      <div
        onMouseDown={onHandleMouseDown}
        onDoubleClick={onHandleDoubleClick}
        title="Sürükle — yeniden boyutlandır · Çift tık: varsayılan"
        className="group flex-shrink-0 w-1 cursor-col-resize relative z-10 hover:w-1 transition-none"
        style={{ userSelect: 'none' }}
      >
        {/* İnce çizgi */}
        <div className="absolute inset-0 bg-border/30 group-hover:bg-blue-400/40 transition-colors" />
        {/* Orta tutaç noktası */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="h-1 w-1 rounded-full bg-blue-400/60" />
          <span className="h-1 w-1 rounded-full bg-blue-400/60" />
          <span className="h-1 w-1 rounded-full bg-blue-400/60" />
        </div>
      </div>

      {/* Sağ panel */}
      <div
        className="flex-shrink-0 flex flex-col border-l border-border/40"
        style={{ width: rightWidth }}
      >
        {right}
      </div>

    </div>
  )
}
