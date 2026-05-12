-- AI Memory: structured per-project decision memory for keyword strategy AI
-- D-07: project_id + user_id + module + key + value(JSONB) + updated_at
-- D-08 modules: 'rules' | 'clusters' | 'analysis' | 'blueprint'

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  module      TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, module, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_project_id
  ON public.ai_memory(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_memory_project_module
  ON public.ai_memory(project_id, module);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their ai_memory"
  ON public.ai_memory
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
