-- Phase 13 fix: constrain wp_status to valid values (WR-03)
-- NULL allowed for rows not yet published to WordPress
ALTER TABLE public.page_packages
  ADD CONSTRAINT page_packages_wp_status_check
  CHECK (wp_status IS NULL OR wp_status IN ('publish', 'draft'));
