-- =============================================================================
-- competitors tablosuna (project_id, domain) unique constraint ekle
-- addCompetitors upsert ignoreDuplicates için gerekli
-- =============================================================================

ALTER TABLE public.competitors
  ADD CONSTRAINT competitors_project_domain_unique UNIQUE (project_id, domain);
