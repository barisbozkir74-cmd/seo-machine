'use client'

export type LockedBannerProps = {
  onUnlockClick: () => void
  isPending?: boolean
}

export function LockedBanner({ onUnlockClick, isPending }: LockedBannerProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-md bg-amber-900/20 border border-amber-700/40">
      <p className="text-xs text-amber-400">
        Bu paket kilitli — düzenlemek için kilidini aç.
      </p>
      <button
        onClick={onUnlockClick}
        disabled={isPending}
        className="text-xs text-amber-400 hover:text-amber-300 underline disabled:opacity-50"
      >
        Kilidini Aç
      </button>
    </div>
  )
}
