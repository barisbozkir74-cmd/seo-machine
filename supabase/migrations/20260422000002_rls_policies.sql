-- =============================================================================
-- SEO Machine — RLS Policies Migration
-- Enables Row Level Security on all 10 core tables with per-user isolation.
-- Policy: a user can only SELECT, INSERT, UPDATE, DELETE their own rows.
-- Decision reference: D-08 (auth.uid() = user_id pattern)
-- Threat mitigations: T-03-01 (RLS bypass), T-03-04 (tampering via user_id change)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. projects
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. stages
-- ---------------------------------------------------------------------------
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stages_select_own" ON public.stages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "stages_insert_own" ON public.stages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stages_update_own" ON public.stages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stages_delete_own" ON public.stages
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. rules
-- ---------------------------------------------------------------------------
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_select_own" ON public.rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "rules_insert_own" ON public.rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rules_update_own" ON public.rules
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rules_delete_own" ON public.rules
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. competitors
-- ---------------------------------------------------------------------------
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitors_select_own" ON public.competitors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "competitors_insert_own" ON public.competitors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "competitors_update_own" ON public.competitors
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "competitors_delete_own" ON public.competitors
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. keywords
-- ---------------------------------------------------------------------------
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keywords_select_own" ON public.keywords
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "keywords_insert_own" ON public.keywords
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "keywords_update_own" ON public.keywords
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "keywords_delete_own" ON public.keywords
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. keyword_clusters
-- ---------------------------------------------------------------------------
ALTER TABLE public.keyword_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keyword_clusters_select_own" ON public.keyword_clusters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "keyword_clusters_insert_own" ON public.keyword_clusters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "keyword_clusters_update_own" ON public.keyword_clusters
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "keyword_clusters_delete_own" ON public.keyword_clusters
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. pages
-- ---------------------------------------------------------------------------
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pages_select_own" ON public.pages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pages_insert_own" ON public.pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pages_update_own" ON public.pages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pages_delete_own" ON public.pages
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. internal_links
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_links_select_own" ON public.internal_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "internal_links_insert_own" ON public.internal_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "internal_links_update_own" ON public.internal_links
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "internal_links_delete_own" ON public.internal_links
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. audits
-- ---------------------------------------------------------------------------
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audits_select_own" ON public.audits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "audits_insert_own" ON public.audits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audits_update_own" ON public.audits
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audits_delete_own" ON public.audits
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 10. workflow_runs
-- ---------------------------------------------------------------------------
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_select_own" ON public.workflow_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workflow_runs_insert_own" ON public.workflow_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflow_runs_update_own" ON public.workflow_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflow_runs_delete_own" ON public.workflow_runs
  FOR DELETE USING (auth.uid() = user_id);
