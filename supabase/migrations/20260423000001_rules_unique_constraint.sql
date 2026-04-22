-- Unique constraint for rules upsert conflict resolution
-- NULLS NOT DISTINCT: treats NULL project_id as equal (global rules never duplicate)
-- Required by: seedGlobalRules onConflict, toggleProjectRule onConflict

ALTER TABLE public.rules
  ADD CONSTRAINT rules_user_project_key_scope_unique
  UNIQUE NULLS NOT DISTINCT (user_id, project_id, rule_key, scope);
