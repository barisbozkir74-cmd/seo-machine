-- Ensure lifecycle columns on project_decisions exist.
-- Migration 20260601000008 added these but may not have been applied to all
-- environments. This migration is fully idempotent (IF NOT EXISTS).
--
-- Also ensures the version column from 20260604000001 is present.

ALTER TABLE public.project_decisions
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT
    NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'locked', 'superseded', 'draft')),
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by    TEXT,
  ADD COLUMN IF NOT EXISTS lock_reason  TEXT,
  ADD COLUMN IF NOT EXISTS version      INTEGER NOT NULL DEFAULT 0;

-- Index for fast lifecycle lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_project_decisions_lifecycle
  ON public.project_decisions(project_id, lifecycle_status)
  WHERE lifecycle_status = 'locked';
