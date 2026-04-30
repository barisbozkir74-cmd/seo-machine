-- ============================================================
-- Phase 16: Recovery Engine — Schema Changes
-- ============================================================
-- D-01, D-02, D-03: recovery_tasks table for decay + weak page recovery
-- Source can be page_package (GSC delta_position decay) or imported_page (flag_weak_page).
-- Status workflow: open → in_progress → resolved (auto via publishToWordPress) | dismissed.

CREATE TABLE IF NOT EXISTS public.recovery_tasks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source           TEXT NOT NULL
    CHECK (source IN ('page_package', 'imported_page')),
  source_id        UUID NOT NULL,
  title            TEXT NOT NULL,
  page_url         TEXT NOT NULL,
  position_before  NUMERIC(5,2),
  position_after   NUMERIC(5,2),
  detected_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- source_id: polymorphic FK — page_packages.id when source='page_package', project_imported_pages.id when source='imported_page'. No DB-level FK to allow either parent.

CREATE INDEX IF NOT EXISTS idx_recovery_tasks_project
  ON public.recovery_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_recovery_tasks_project_status
  ON public.recovery_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_recovery_tasks_source_lookup
  ON public.recovery_tasks(source, source_id, status);

CREATE TRIGGER set_recovery_tasks_updated_at
  BEFORE UPDATE ON public.recovery_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recovery_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recovery_tasks_select_own"
  ON public.recovery_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = recovery_tasks.project_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "recovery_tasks_update_own"
  ON public.recovery_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = recovery_tasks.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = recovery_tasks.project_id
        AND p.user_id = auth.uid()
    )
  );

-- INSERT/DELETE: service role only (n8n detect route, server-action publishToWordPress auto-resolve).
-- Service role bypasses RLS — no INSERT/DELETE policy declared for end-users.
-- User-initiated mutations (dismiss, in_progress) go through the UPDATE policy via the anon-key
-- server-side client in updateRecoveryTaskStatus (Plan 16-04). Note that updateRecoveryTaskStatus
-- ALSO performs explicit ownership verification before issuing the UPDATE — RLS is defence-in-depth.
