-- Phase 13: WordPress Publishing — publish result tracking
-- Adds four columns to page_packages:
--   wp_post_id INTEGER: WordPress post ID after successful publish
--   wp_post_url TEXT: Public URL of the WordPress post
--   wp_published_at TIMESTAMPTZ: Timestamp of publish/draft save
--   wp_status TEXT: 'publish' | 'draft'
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS wp_post_id       INTEGER,
  ADD COLUMN IF NOT EXISTS wp_post_url      TEXT,
  ADD COLUMN IF NOT EXISTS wp_published_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wp_status        TEXT;
