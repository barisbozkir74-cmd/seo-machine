'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Eye01Icon, EyeOff01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { saveWordPressCredentials } from './actions'

type Props = {
  projectId: string
  isConfigured: boolean // Vault'tan SSR'da kontrol edilmiş
}

export function WordPressConnectionSection({ projectId, isConfigured }: Props) {
  const [wpUrl, setWpUrl] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(isConfigured)

  const isDirty = wpUrl.trim().length > 0 || appPassword.trim().length > 0

  const handleSave = async () => {
    setError(null)

    // Client-side validation
    if (!wpUrl.startsWith('https://')) {
      setError('Geçerli bir WordPress URL\'si girin (https:// ile başlamalı).')
      return
    }
    if (!appPassword.trim()) {
      setError('Uygulama Şifresi gereklidir.')
      return
    }

    setSaving(true)
    try {
      const result = await saveWordPressCredentials(projectId, wpUrl, appPassword)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
      setWpUrl('')
      setAppPassword('')
    } catch {
      setError('İşlem başarısız. Lütfen tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Başlık + Durum Badge */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">WordPress Bağlantısı</h2>
        <Badge
          aria-live="polite"
          className={
            saved
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }
        >
          {saved ? 'Bağlı' : 'Yapılandırılmadı'}
        </Badge>
      </div>

      {/* WordPress URL */}
      <div className="space-y-1.5">
        <label htmlFor="wp-url" className="text-sm text-muted-foreground">
          WordPress URL
        </label>
        <Input
          id="wp-url"
          type="url"
          value={wpUrl}
          onChange={(e) => setWpUrl(e.target.value)}
          placeholder="https://example.com"
          className="text-sm h-9"
          disabled={saving}
        />
      </div>

      {/* Uygulama Şifresi */}
      <div className="space-y-1.5">
        <label htmlFor="wp-app-password" className="text-sm text-muted-foreground">
          Uygulama Şifresi
        </label>
        <div className="relative">
          <Input
            id="wp-app-password"
            type={showPassword ? 'text' : 'password'}
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder={saved ? '••••••••••••' : 'xxxx xxxx xxxx xxxx'}
            className="text-sm h-9 pr-10"
            disabled={saving}
            aria-label="Uygulama Şifresi"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-9 w-10 px-0"
            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            onMouseDown={(e) => {
              e.preventDefault() // input focus korunur
              setShowPassword((v) => !v)
            }}
          >
            <HugeiconsIcon
              icon={showPassword ? EyeOff01Icon : Eye01Icon}
              size={16}
              className="text-muted-foreground"
            />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uygulama Şifresini WordPress Admin &gt; Profil &gt; Uygulama Şifrelerinden oluşturun.
        </p>
      </div>

      {/* Hata mesajı */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Kaydet butonu */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="min-h-[44px]"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}
