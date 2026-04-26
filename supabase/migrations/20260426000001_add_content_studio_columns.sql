-- Phase 12: Content Studio — section-by-section AI content generation
-- Adds two columns to page_packages:
--   content_sections JSONB: array of section objects with heading, level, sub_headings, content, status
--   html_content TEXT: WordPress-ready assembled HTML (populated when all sections approved)
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS content_sections JSONB,
  ADD COLUMN IF NOT EXISTS html_content     TEXT;
