'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { createProject, type CreateProjectInput } from './actions'

// Client-side schema — mirrors server schema for instant feedback (zod v4)
const formSchema = z.object({
  name: z.string().min(1, 'Proje adı zorunludur').max(100),
  domain: z
    .string()
    .min(1, 'Domain zorunludur')
    .max(253)
    .regex(/^[^\s]+\.[^\s]+$/, 'Geçerli bir domain girin (örn. musteri.com)'),
  sector: z.string().max(100).optional().or(z.literal('')),
  target_country: z.string().max(100).optional().or(z.literal('')),
  target_language: z.string().max(100).optional().or(z.literal('')),
  business_model: z.string().max(100).optional().or(z.literal('')),
  site_type: z.string().max(100).optional().or(z.literal('')),
  brand_tone: z.string().max(100).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof formSchema>

interface NewProjectModalProps {
  children: React.ReactNode
}

export function NewProjectModal({ children }: NewProjectModalProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      domain: '',
      sector: '',
      target_country: '',
      target_language: '',
      business_model: '',
      site_type: '',
      brand_tone: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setFormError(null)
    try {
      const result = await createProject(values as CreateProjectInput)
      if (result.success) {
        form.reset()
        setOpen(false)
        // revalidatePath server'da çalıştı — liste kendiliğinden güncellenir
      } else {
        setFormError(result.error)
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof FormValues, { message: errors[0] })
          })
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement}></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Proje Oluştur</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Zorunlu alanlar */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Proje Adı <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="örn. Müşteri Projesi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Domain <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="örn. musteri.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Opsiyonel alanlar bölümü */}
            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">Opsiyonel Bilgiler</span>
              <Separator className="flex-1" />
            </div>

            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sektör</FormLabel>
                  <FormControl>
                    <Input placeholder="örn. E-ticaret" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hedef Ülke</FormLabel>
                  <FormControl>
                    <Input placeholder="örn. Türkiye" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hedef Dil</FormLabel>
                  <FormControl>
                    <Input placeholder="örn. Türkçe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="business_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İş Modeli</FormLabel>
                  <FormControl>
                    <Input placeholder="örn. B2B SaaS" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Tipi</FormLabel>
                  <FormControl>
                    <Input placeholder="örn. Kurumsal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brand_tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marka Tonu</FormLabel>
                  <FormControl>
                    <Input placeholder="örn. Profesyonel, samimi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Genel form hatası */}
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Formu Kapat
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Oluşturuluyor...' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
