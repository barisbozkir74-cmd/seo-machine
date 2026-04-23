-- =============================================================================
-- Phase 4 Gap Closure: projects tablosuna own_category_structure kolonu ekle
-- CR-01 fix: OwnDomainAnalyzeButton'ın ürettiği veri artık persist edilecek
-- =============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS own_category_structure JSONB;

-- Bu kolon kullanıcının kendi domain'inin kategori yapısını saklar.
-- Shape: { [category: string]: number } (category -> pageCount)
-- "Kendi Sitemi Analiz Et" butonu tıklandığında fetchOwnDomainData bu kolona yazar.
-- Null = henüz analiz yapılmamış.
