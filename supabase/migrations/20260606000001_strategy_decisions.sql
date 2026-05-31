-- ============================================================
-- strategy_decisions — v5.0 Keyword Strategy Command Center
--
-- PRECEDENCE RULE (v5.0):
--   is_locked=true satırlar keyword_clusters.status,
--   arch_status ve keyword_strategy_approved'dan her zaman
--   önceliklidir. Bu kural uygulama katmanında uygulanır.
--
-- module değerleri:
--   'cluster_priority' | 'primary_keyword' | 'page_type' |
--   'cannibalization' | 'authority_structure' |
--   'target_url' | 'starred_keywords'
-- ============================================================
CREATE TABLE public.strategy_decisions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  module      TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  reason      TEXT,
  locked_at   TIMESTAMPTZ,
  locked_by   UUID REFERENCES auth.users(id),
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, module, key)
);

ALTER TABLE public.strategy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their strategy_decisions"
  ON public.strategy_decisions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_project_id
  ON public.strategy_decisions(project_id);

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_project_module
  ON public.strategy_decisions(project_id, module);

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_locked
  ON public.strategy_decisions(project_id, is_locked)
  WHERE is_locked = true;
