import { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Create account — SEO Machine',
}

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignupForm />
    </main>
  )
}
