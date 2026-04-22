-- =============================================================================
-- SEO Machine — Core Schema Migration
-- Creates all 10 core tables with UUID PKs, user_id FK, created_at + updated_at
-- Decision references: D-05 (UUID PKs), D-06 (hard deletes), D-07 (timestamps), D-08 (user_id FK)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared trigger function for updated_at (created once, applied to all tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. projects — Core entity; all other tables reference it
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  domain          TEXT NOT NULL,
  sector          TEXT,
  target_country  TEXT,
  target_language TEXT,
  business_model  TEXT,
  site_type       TEXT,
  brand_tone      TEXT,
  notes           TEXT,
  current_stage   TEXT NOT NULL DEFAULT 'intake',
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. stages — Stage transition history for each project (10-stage engine)
-- ---------------------------------------------------------------------------
CREATE TABLE public.stages (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  stage_name    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_stages_updated_at
  BEFORE UPDATE ON public.stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. rules — Global and project-scoped SEO rules
-- ---------------------------------------------------------------------------
CREATE TABLE public.rules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  scope         TEXT NOT NULL DEFAULT 'global',
  rule_key      TEXT NOT NULL,
  rule_value    TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. competitors — Per-project competitor list
-- ---------------------------------------------------------------------------
CREATE TABLE public.competitors (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  domain              TEXT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'manual',
  top_pages           JSONB,
  category_structure  JSONB,
  content_areas       JSONB,
  gap_report          JSONB,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_competitors_updated_at
  BEFORE UPDATE ON public.competitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. keywords — Per-project keyword list with enrichment data
-- ---------------------------------------------------------------------------
CREATE TABLE public.keywords (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  keyword           TEXT NOT NULL,
  volume            INTEGER,
  cpc               NUMERIC(10, 2),
  difficulty        INTEGER,
  search_intent     TEXT,
  opportunity_score NUMERIC(5, 2),
  source            TEXT NOT NULL DEFAULT 'manual',
  enriched_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_keywords_updated_at
  BEFORE UPDATE ON public.keywords
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. keyword_clusters — Keyword groupings with primary keyword
-- ---------------------------------------------------------------------------
CREATE TABLE public.keyword_clusters (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id         UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  cluster_name       TEXT NOT NULL,
  primary_keyword_id UUID REFERENCES public.keywords(id) ON DELETE SET NULL,
  intent             TEXT,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_keyword_clusters_updated_at
  BEFORE UPDATE ON public.keyword_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add cluster_id FK back to keywords (after keyword_clusters exists)
ALTER TABLE public.keywords
  ADD COLUMN cluster_id UUID REFERENCES public.keyword_clusters(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 7. pages — Site blueprint pages
-- ---------------------------------------------------------------------------
CREATE TABLE public.pages (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id       UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  parent_id        UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  cluster_id       UUID REFERENCES public.keyword_clusters(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL,
  page_type        TEXT NOT NULL DEFAULT 'page',
  focus_keyword_id UUID REFERENCES public.keywords(id) ON DELETE SET NULL,
  search_intent    TEXT,
  priority         TEXT NOT NULL DEFAULT 'medium',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. internal_links — Internal link map between pages
-- ---------------------------------------------------------------------------
CREATE TABLE public.internal_links (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_page_id  UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  target_page_id  UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  anchor_text     TEXT,
  link_type       TEXT NOT NULL DEFAULT 'contextual',
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_internal_links_updated_at
  BEFORE UPDATE ON public.internal_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. audits — Decision memory / audit log per project
-- ---------------------------------------------------------------------------
CREATE TABLE public.audits (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  event_type  TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. workflow_runs — Tracks async jobs (DataForSEO enrichment, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE public.workflow_runs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  workflow_type   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  input_payload   JSONB,
  result_payload  JSONB,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_workflow_runs_updated_at
  BEFORE UPDATE ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Performance indexes on high-traffic FK columns (T-02-04 mitigation)
-- Supabase auto-indexes PKs; we add indexes for FK columns used in WHERE clauses
-- =============================================================================

-- projects: queried by user_id on every dashboard load
CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- stages: always queried by project_id to get stage history
CREATE INDEX idx_stages_project_id ON public.stages(project_id);
CREATE INDEX idx_stages_user_id ON public.stages(user_id);

-- rules: scope-based lookups by user_id and project_id
CREATE INDEX idx_rules_user_id ON public.rules(user_id);
CREATE INDEX idx_rules_project_id ON public.rules(project_id);

-- competitors: per-project competitor list
CREATE INDEX idx_competitors_project_id ON public.competitors(project_id);
CREATE INDEX idx_competitors_user_id ON public.competitors(user_id);

-- keywords: largest table — heavily queried by project
CREATE INDEX idx_keywords_project_id ON public.keywords(project_id);
CREATE INDEX idx_keywords_user_id ON public.keywords(user_id);
CREATE INDEX idx_keywords_cluster_id ON public.keywords(cluster_id);

-- keyword_clusters: queried by project and primary keyword
CREATE INDEX idx_keyword_clusters_project_id ON public.keyword_clusters(project_id);
CREATE INDEX idx_keyword_clusters_user_id ON public.keyword_clusters(user_id);

-- pages: site blueprint tree; queried by project and parent
CREATE INDEX idx_pages_project_id ON public.pages(project_id);
CREATE INDEX idx_pages_user_id ON public.pages(user_id);
CREATE INDEX idx_pages_parent_id ON public.pages(parent_id);
CREATE INDEX idx_pages_cluster_id ON public.pages(cluster_id);

-- internal_links: link map lookups by source or target page
CREATE INDEX idx_internal_links_project_id ON public.internal_links(project_id);
CREATE INDEX idx_internal_links_source_page_id ON public.internal_links(source_page_id);
CREATE INDEX idx_internal_links_target_page_id ON public.internal_links(target_page_id);

-- audits: append-only log; queried by project and event_type
CREATE INDEX idx_audits_project_id ON public.audits(project_id);
CREATE INDEX idx_audits_user_id ON public.audits(user_id);

-- workflow_runs: status checks and project-level listing
CREATE INDEX idx_workflow_runs_project_id ON public.workflow_runs(project_id);
CREATE INDEX idx_workflow_runs_user_id ON public.workflow_runs(user_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);
