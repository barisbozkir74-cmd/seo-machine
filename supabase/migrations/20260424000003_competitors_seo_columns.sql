ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS ranked_keywords JSONB,
  ADD COLUMN IF NOT EXISTS backlinks_summary JSONB;
