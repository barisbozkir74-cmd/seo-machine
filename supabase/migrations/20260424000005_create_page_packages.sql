-- =============================================================================
-- SEO Machine — Page Packages Table
-- Phase 9: page_packages tablosu (page_id UNIQUE — Phase 9'da versioning yok)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.page_packages (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id           UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  -- SEO Fields
  seo_title         TEXT,
  meta_description  TEXT,
  h1                TEXT,
  slug              TEXT,
  search_intent     TEXT,
  strategic_purpose TEXT,
  secondary_keywords JSONB DEFAULT '[]',
  heading_hierarchy  JSONB DEFAULT '[]',
  content_blocks     JSONB DEFAULT '[]',
  cta_blocks         JSONB DEFAULT '[]',
  image_plan         JSONB DEFAULT '[]',
  alt_texts          JSONB DEFAULT '[]',
  schema_type        TEXT,
  canonical_url      TEXT,
  faq                JSONB DEFAULT '[]',
  -- QA (client-side hesaplanan skorlar)
  qa_scores          JSONB DEFAULT '{}',
  -- Traceability
  generated_by       TEXT NOT NULL DEFAULT 'manual',
  ai_model           TEXT,
  -- Timestamps
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at        TIMESTAMPTZ,
  locked_at          TIMESTAMPTZ,
  -- Phase 9: tek package per sayfa (versioning Phase 12'de gelir)
  UNIQUE(page_id)
);

-- Performans indexleri
CREATE INDEX IF NOT EXISTS idx_page_packages_project_id ON public.page_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_page_packages_page_id    ON public.page_packages(page_id);
CREATE INDEX IF NOT EXISTS idx_page_packages_user_id    ON public.page_packages(user_id);

-- updated_at trigger (set_updated_at fonksiyonu mevcut tablolarda tanımlı)
CREATE TRIGGER set_page_packages_updated_at
  BEFORE UPDATE ON public.page_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.page_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_packages_select_own" ON public.page_packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "page_packages_insert_own" ON public.page_packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "page_packages_update_own" ON public.page_packages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "page_packages_delete_own" ON public.page_packages
  FOR DELETE USING (auth.uid() = user_id);
