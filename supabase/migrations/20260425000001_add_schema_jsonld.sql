-- Phase 10: Schema Center — schema_jsonld column
-- Adds JSONB column to page_packages for storing generated JSON-LD objects.
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS schema_jsonld JSONB;
