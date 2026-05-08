-- Phase 19: keywords.source kolonuna CHECK constraint ekle.
-- Geçerli değerler: 'manual' (CSV/paste import), 'competitor' (DataForSEO ranked_keywords),
-- 'expansion' (DataForSEO related_keywords). Diğer her değer reddedilir.

ALTER TABLE public.keywords
  DROP CONSTRAINT IF EXISTS keywords_source_check;

ALTER TABLE public.keywords
  ADD CONSTRAINT keywords_source_check
  CHECK (source IN ('manual', 'competitor', 'expansion'));
