'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { discoverCompetitors, addCompetitors } from './actions'

type Props = {
  projectId: string
}

type Step = 'keyword-input' | 'domain-select'

export function CompetitorDiscoveryDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('keyword-input')
  const [keywords, setKeywords] = useState(['', '', ''])
  const [discoveredDomains, setDiscoveredDomains] = useState<string[]>([])
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set())
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetDialog = () => {
    setStep('keyword-input')
    setKeywords(['', '', ''])
    setDiscoveredDomains([])
    setSelectedDomains(new Set())
    setError(null)
    setIsPending(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) resetDialog()
  }

  const handleDiscover = async () => {
    const filledKeywords = keywords.map((k) => k.trim()).filter(Boolean)
    if (!filledKeywords.length) {
      setError('En az bir keyword girin.')
      return
    }

    setIsPending(true)
    setError(null)
    try {
      const result = await discoverCompetitors(projectId, filledKeywords)
      if (!result.success) {
        setError(result.error)
      } else {
        setDiscoveredDomains(result.domains)
        setSelectedDomains(new Set(result.domains)) // hepsini varsayılan seçili yap
        setStep('domain-select')
      }
    } catch {
      setError('Rakip keşfi başarısız. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  const handleAddSelected = async () => {
    if (!selectedDomains.size) {
      setError('En az bir rakip seçin.')
      return
    }

    setIsPending(true)
    setError(null)
    try {
      const result = await addCompetitors(projectId, Array.from(selectedDomains))
      if (!result.success) {
        setError(result.error)
      } else {
        setOpen(false)
        resetDialog()
      }
    } catch {
      setError('Rakipler eklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) {
        next.delete(domain)
      } else {
        next.add(domain)
      }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline">Rakip Keşfet</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'keyword-input' ? 'Rakip Keşfet' : 'Rakipleri Seç'}
          </DialogTitle>
        </DialogHeader>

        {step === 'keyword-input' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              1-3 hedef keyword girin. DataForSEO bu keyword&apos;ler için SERP&apos;te sıralanan rakipleri bulacak.
            </p>
            {keywords.map((kw, i) => (
              <Input
                key={i}
                placeholder={`Keyword ${i + 1}${i > 0 ? ' (opsiyonel)' : ''}`}
                value={kw}
                onChange={(e) => {
                  const next = [...keywords]
                  next[i] = e.target.value
                  setKeywords(next)
                }}
                disabled={isPending}
              />
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                onClick={handleDiscover}
                disabled={isPending}
                className={isPending ? 'opacity-50 cursor-wait' : ''}
              >
                {isPending ? 'Aranıyor...' : 'Ara'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'domain-select' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {discoveredDomains.length} rakip bulundu. Eklemek istediklerinizi seçin.
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-border rounded-md p-3">
              {discoveredDomains.map((domain) => (
                <label
                  key={domain}
                  className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 px-2 py-1.5 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedDomains.has(domain)}
                    onChange={() => toggleDomain(domain)}
                    className="rounded"
                  />
                  <span className="text-sm">{domain}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep('keyword-input')}>
                ← Geri
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={isPending || !selectedDomains.size}
                className={isPending ? 'opacity-50 cursor-wait' : ''}
              >
                {isPending ? 'Ekleniyor...' : `Seçilenleri Ekle (${selectedDomains.size})`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
