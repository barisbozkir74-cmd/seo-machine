-- Phase 20: AI Keyword Clustering & Approval
-- keyword_clusters: clustering onay akışı için status kolonu
-- projects: keyword strateji onay gate flag'i
-- NOT: keyword_clusters'da zaten arch_status var (site blueprint akışı — farklı amaç).
-- Bu status kolonu = clustering onay aşaması (draft/approved/rejected).

-- 1. keyword_clusters.status kolonu ekle
ALTER TABLE public.keyword_clusters
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'approved', 'rejected'));

-- 2. Mevcut cluster'lara 'approved' ata (geriye dönük uyumluluk — D-07)
-- Yeni sistemde yeniden kümelendirmeden önce oluşturulan tüm cluster'lar onaylı sayılır.
UPDATE public.keyword_clusters
  SET status = 'approved'
  WHERE status = 'draft';

-- 3. projects.keyword_strategy_approved ekle (Phase 21 gate kontrolü için)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS keyword_strategy_approved BOOLEAN DEFAULT false NOT NULL;
