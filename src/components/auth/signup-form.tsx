'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'

// TODO: implement in Plan 04
// import { createClient } from '@/lib/supabase/client'

const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .min(8, 'Password must be at least 8 characters.'),
})

type SignupFormValues = z.infer<typeof signupSchema>

export function SignupForm() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const { isSubmitting } = form.formState

  async function onSubmit(values: SignupFormValues) {
    setAuthError(null)
    try {
      // TODO: implement in Plan 04
      // const supabase = createClient()
      // const { error } = await supabase.auth.signUp({
      //   email: values.email,
      //   password: values.password,
      // })
      // if (error) {
      //   if (error.message.toLowerCase().includes('already')) {
      //     setAuthError('An account with this email already exists. Sign in instead.')
      //   } else {
      //     setAuthError('Something went wrong. Please try again.')
      //   }
      //   return
      // }
      // router.push('/dashboard')
      console.log('Signup stub — implement in Plan 04', values)
      router.push('/dashboard')
    } catch {
      setAuthError('Something went wrong. Please try again.')
    }
  }

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and password to get started.
        </p>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="signup-email">Email</Label>
                  <FormControl>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="signup-password">Password</Label>
                  <FormControl>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {authError && (
              <p className="text-sm text-destructive text-center">{authError}</p>
            )}
            <Button
              type="submit"
              className="w-full h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="underline">
                Sign in
              </a>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
