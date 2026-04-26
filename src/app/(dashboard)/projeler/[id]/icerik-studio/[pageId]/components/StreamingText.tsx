'use client'

type StreamingTextProps = {
  text: string
  isStreaming: boolean
}

export function StreamingText({ text, isStreaming }: StreamingTextProps) {
  return (
    <div className="min-h-[120px] text-sm text-foreground">
      <span className="whitespace-pre-wrap">{text}</span>
      {isStreaming && <span className="animate-pulse text-muted-foreground ml-0.5">▋</span>}
      {!text && !isStreaming && (
        <span className="text-muted-foreground">Bu bölüm henüz üretilmedi.</span>
      )}
    </div>
  )
}
