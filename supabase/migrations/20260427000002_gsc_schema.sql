-- ============================================================
-- Phase 14: GSC Integration — Schema Changes
-- ============================================================

-- 1. projects tablosu: GSC token ve property URL sütunları
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS gsc_tokens       JSONB,
  ADD COLUMN IF NOT EXISTS gsc_property_url TEXT;
-- gsc_tokens: server-only; SELECT sorgularına asla dahil edilmez
-- gsc_property_url: Sites.list API'den dönen tam property URL (sc-domain: formatı dahil)

-- 2. page_packages tablosu: GSC index durumu sütunları
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS gsc_index_status     TEXT
    CHECK (gsc_index_status IS NULL OR gsc_index_status IN ('indexed', 'not_indexed', 'crawled_not_indexed')),
  ADD COLUMN IF NOT EXISTS gsc_index_checked_at TIMESTAMPTZ;
-- gsc_index_status: URL Inspection API verdict'ından türetilir
-- gsc_index_checked_at: son kontrol zamanı; rate limit kontrolü için kullanılır

-- 3. gsc_metrics tablosu: Search Analytics günlük/keyword bazlı performans
CREATE TABLE IF NOT EXISTS public.gsc_metrics (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  page_id       UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  keyword       TEXT NOT NULL,
  clicks        INTEGER NOT NULL DEFAULT 0,
  impressions   INTEGER NOT NULL DEFAULT 0,
  avg_position  NUMERIC(5,2),
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(page_id, date, keyword)
);

-- Composite index: Phase 15 Monitoring Dashboard sorguları için hazır
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_page_date
  ON public.gsc_metrics(page_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_project_date
  ON public.gsc_metrics(project_id, date DESC);

-- RLS: gsc_metrics için
ALTER TABLE public.gsc_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gsc_metrics_select_own"
  ON public.gsc_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = gsc_metrics.project_id
        AND p.user_id = auth.uid()
    )
  );
-- INSERT/UPDATE: n8n service role key ile yapılır — service role RLS bypass eder
