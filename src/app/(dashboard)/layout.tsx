import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-8 py-3 flex items-center gap-6">
        <Link
          href="/projeler"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Projeler
        </Link>
        <Link
          href="/ayarlar/kurallar"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Ayarlar
        </Link>
      </nav>
      {children}
    </div>
  )
}
