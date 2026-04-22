import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">SEO Machine</h1>
        <p className="text-muted-foreground">
          Welcome, {user?.email}. Phase 2 will build the full dashboard.
        </p>
      </div>
    </main>
  )
}
