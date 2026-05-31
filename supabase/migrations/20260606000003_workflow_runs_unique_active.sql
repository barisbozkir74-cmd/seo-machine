-- Phase 24 CR-02: Atomic concurrent guard for workflow_runs
-- Prevents TOCTOU race in triggerDeepAnalysisAction where two simultaneous
-- requests could both pass the pending/running check before either INSERT.
--
-- Partial unique index: only one active (pending or running) job per project
-- per workflow_type may exist at any time. The INSERT will raise error 23505
-- (unique_violation) if a race occurs; the action catches this and returns
-- a clean "already running" response.

CREATE UNIQUE INDEX IF NOT EXISTS workflow_runs_one_active_per_project
  ON public.workflow_runs(project_id, workflow_type)
  WHERE status IN ('pending', 'running');
