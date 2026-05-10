-- =============================================================================
-- SEO Machine — Page Package Revisions Table
-- Phase 22: Her kaydet aksiyonunda otomatik snapshot
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.page_package_revisions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id  UUID NOT NULL REFERENCES public.page_packages(id) ON DELETE CASCADE,
  page_id     UUID NOT NULL,
  project_id  UUID NOT NULL,
  user_id     UUID NOT NULL,
  snapshot    JSONB NOT NULL,
  version_num INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_package_revisions_package_id
  ON public.page_package_revisions(package_id, version_num DESC);

CREATE INDEX IF NOT EXISTS idx_page_package_revisions_project_id
  ON public.page_package_revisions(project_id);

ALTER TABLE public.page_package_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_package_revisions_select_own" ON public.page_package_revisions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "page_package_revisions_insert_own" ON public.page_package_revisions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
