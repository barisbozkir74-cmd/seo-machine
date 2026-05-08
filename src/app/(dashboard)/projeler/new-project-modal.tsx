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
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { createProject, type CreateProjectInput } from './actions'

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
  target_customer: z.string().max(500).optional().or(z.literal('')),
  main_goal: z.string().max(1000).optional().or(z.literal('')),
  initial_competitors: z.string().max(1000).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  custom_rules: z.string().max(2000).optional().or(z.literal('')),
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
      target_customer: '',
      main_goal: '',
      initial_competitors: '',
      notes: '',
      custom_rules: '',
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

            {/* ── Zorunlu ── */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proje Adı <span className="text-destructive">*</span></FormLabel>
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
                  <FormLabel>Domain <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="musteri.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Proje Tanımı ── */}
            <div className="flex items-center gap-4 pt-1">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">Proje Tanımı</span>
              <Separator className="flex-1" />
            </div>

            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sektör</FormLabel>
                  <FormControl>
                    <Input placeholder="E-ticaret, SaaS, Hukuk..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="main_goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ana Hedef</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Bu projenin birincil hedefi nedir? Organik trafik artışı, lead generation, marka bilinirliği..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_customer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hedef Müşteri Tipi</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Kimler bu siteyi kullanacak? KOBİ sahipleri, 25-40 yaş arası kadınlar, IT yöneticileri..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Teknik Bilgiler ── */}
            <div className="flex items-center gap-4 pt-1">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">Teknik Bilgiler</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="target_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hedef Ülke</FormLabel>
                    <FormControl>
                      <Input placeholder="Türkiye" {...field} />
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
                      <Input placeholder="Türkçe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="business_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İş Modeli</FormLabel>
                    <FormControl>
                      <Input placeholder="B2B, B2C, SaaS..." {...field} />
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
                      <Input placeholder="Kurumsal, E-ticaret..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="brand_tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marka Tonu</FormLabel>
                  <FormControl>
                    <Input placeholder="Profesyonel ve güvenilir, samimi ve sıcak..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Rekabet & Kurallar ── */}
            <div className="flex items-center gap-4 pt-1">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">Rekabet & Kurallar</span>
              <Separator className="flex-1" />
            </div>

            <FormField
              control={form.control}
              name="initial_competitors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rakipler</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="rakip1.com, rakip2.com, rakip3.com"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="custom_rules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Özel Kurallar</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Marka adı her başlıkta geçmeli, rakip markalardan bahsedilmemeli..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notlar</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Müşteri hakkında önemli notlar, dikkat edilmesi gerekenler..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Kapat
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
