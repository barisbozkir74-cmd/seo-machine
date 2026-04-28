-- ============================================================
-- Phase 15.5: WordPress Site Import Engine — Schema Changes
-- ============================================================

-- 1. projects tablosu: Import progress state kolonları
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS import_status       TEXT
    CHECK (import_status IS NULL OR import_status IN ('idle','running','enriching','complete','error')),
  ADD COLUMN IF NOT EXISTS import_current      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_total        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_completed_at TIMESTAMPTZ;
-- import_status: NULL = henüz import başlatılmadı
-- import_current: kaç sayfa işlendi
-- import_total: toplam sayfa sayısı
-- import_completed_at: son başarılı import zamanı

-- 2. project_imported_pages tablosu: WP REST API'den çekilen sayfalar
CREATE TABLE IF NOT EXISTS public.project_imported_pages (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  wp_id             INTEGER NOT NULL,                    -- WP post/page ID
  wp_type           TEXT NOT NULL                        -- 'page' | 'post' | 'category' | 'tag'
    CHECK (wp_type IN ('page', 'post', 'category', 'tag')),
  title             TEXT NOT NULL,
  slug              TEXT,
  link              TEXT,                                -- public URL (WP 'link' field)
  parent_wp_id      INTEGER,                            -- WP parent ID (0 = root, NULL = kök)
  wp_created_at     TIMESTAMPTZ,
  wp_modified_at    TIMESTAMPTZ,
  -- AI enrichment (import sonrası toplu doldurulur)
  content_summary   TEXT,                               -- max 200 char (claude-haiku-4-5)
  primary_intent    TEXT
    CHECK (primary_intent IS NULL OR primary_intent IN ('informational','commercial','transactional','navigational')),
  -- GSC eşleştirmesi (URL normalize + Search Analytics API)
  gsc_clicks        INTEGER,
  gsc_impressions   INTEGER,
  gsc_avg_position  NUMERIC(5,2),
  -- Audit flags
  flag_orphan            BOOLEAN NOT NULL DEFAULT false,
  flag_weak_page         BOOLEAN,                       -- GSC yoksa NULL (D-10)
  flag_outdated          BOOLEAN NOT NULL DEFAULT false,
  flag_missing_metadata  BOOLEAN NOT NULL DEFAULT false,
  flag_missing_keyword   BOOLEAN NOT NULL DEFAULT false,
  flag_duplicate_intent  BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  imported_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- Constraint: wp_id UNIQUE per project (re-import idempotent — D-09)
  UNIQUE (project_id, wp_id)
);

-- 3. Index: project_id üzerinden hızlı sorgu
CREATE INDEX IF NOT EXISTS idx_imported_pages_project
  ON public.project_imported_pages(project_id);

-- 4. RLS: project_imported_pages için
ALTER TABLE public.project_imported_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imported_pages_select_own"
  ON public.project_imported_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_imported_pages.project_id
        AND p.user_id = auth.uid()
    )
  );
-- INSERT/UPDATE: service role ile yapılır — service role RLS bypass eder
