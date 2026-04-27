'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { initiateGscOAuth, saveGscProperty } from './actions'

type GscProperty = { siteUrl: string; permissionLevel: string }

type Props = {
  projectId: string
  isConnected: boolean
  gscPropertyUrl: string | null
}

export function GscConnectionSection({ projectId, isConnected, gscPropertyUrl }: Props) {
  const [connecting, setConnecting] = useState(false)
  const [properties, setProperties] = useState<GscProperty[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<string>(gscPropertyUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState(false)

  // D-04: isConnected=true ve henüz property seçilmemişse property listesini API'den çek
  useEffect(() => {
    if (!isConnected || gscPropertyUrl) return

    setPropertiesLoading(true)
    fetch(`/api/gsc/properties?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.properties) {
          setProperties(data.properties)
        } else {
          setError('Property listesi alınamadı. Tekrar deneyin.')
        }
      })
      .catch(() => setError('Property listesi yüklenemedi. Bağlantınızı kontrol edin.'))
      .finally(() => setPropertiesLoading(false))
  }, [isConnected, gscPropertyUrl, projectId])

  // URL'de error param varsa göster (callback'ten gelen)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'gsc_csrf') setError('Geçersiz oturum. Lütfen tekrar bağlanın.')
    if (err === 'gsc_denied') setError('Google bağlantısı iptal edildi. Tekrar deneyin.')
    if (err === 'gsc_token_failed') setError('Token alınamadı. Tekrar deneyin.')
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      await initiateGscOAuth(projectId)
    } catch {
      setError('Bağlantı başlatılamadı. Tekrar deneyin.')
      setConnecting(false)
    }
  }

  const handleSaveProperty = async () => {
    if (!selectedProperty) return
    setSaving(true)
    setError(null)
    try {
      const result = await saveGscProperty(projectId, selectedProperty)
      if (!result.success) {
        setError(result.error ?? 'Property kaydedilemedi.')
      }
    } catch {
      setError('Kaydetme başarısız. Tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncSuccess(false)
    setError(null)
    try {
      const res = await fetch('/api/gsc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) throw new Error('sync failed')
      setSyncSuccess(true)
    } catch {
      setError('Senkronizasyon başarısız. Tekrar deneyin.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Başlık + durum badge */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Google Search Console Bağlantısı</h2>
        {isConnected ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            Bağlı
          </Badge>
        ) : (
          <Badge className="bg-slate-800 text-slate-400 border-slate-700">
            Yapılandırılmadı
          </Badge>
        )}
      </div>

      {/* Property dropdown — bağlıysa ve property seçilmemişse */}
      {isConnected && !gscPropertyUrl && (
        <div className="space-y-2">
          {propertiesLoading ? (
            <p className="text-sm text-muted-foreground">Property listesi yükleniyor...</p>
          ) : (
            <Select value={selectedProperty} onValueChange={(v) => setSelectedProperty(v ?? '')}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Bir property seçin" />
              </SelectTrigger>
              <SelectContent>
                {properties.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Search Console&apos;da kayıtlı property bulunamadı.
                  </SelectItem>
                ) : (
                  properties.map((p) => (
                    <SelectItem key={p.siteUrl} value={p.siteUrl}>
                      {p.siteUrl}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Seçili property göster */}
      {isConnected && gscPropertyUrl && (
        <p className="text-sm text-muted-foreground">{gscPropertyUrl}</p>
      )}

      {/* Senkronize Et + son sync (property seçiliyse) */}
      {isConnected && gscPropertyUrl && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            aria-label="GSC verilerini senkronize et"
          >
            {syncing ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
          </Button>
          {syncSuccess && (
            <span className="text-xs text-muted-foreground">
              Son senkronizasyon:{' '}
              {new Date().toLocaleString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      )}

      {/* Hata mesajı */}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* CTA buton alanı */}
      <div className="flex justify-end">
        {!isConnected && (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="min-h-[44px]"
            aria-label="Google Search Console'a bağlan"
          >
            {connecting ? 'Bağlanıyor...' : 'GSC Bağla'}
          </Button>
        )}
        {isConnected && !gscPropertyUrl && selectedProperty && selectedProperty !== '_empty' && (
          <Button
            onClick={handleSaveProperty}
            disabled={saving}
            className="min-h-[44px]"
            aria-label="Seçilen GSC property'yi kaydet"
          >
            {saving ? 'Kaydediliyor...' : 'Seçimi Kaydet'}
          </Button>
        )}
      </div>
    </div>
  )
}
