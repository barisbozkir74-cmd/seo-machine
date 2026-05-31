-- keywords.dfs_fetched_at — Phase 24 DataForSEO Validation Layer
--
-- NOT: DEFAULT now() kasıtlı olarak eklenmedi.
-- Mevcut tüm keywordler NULL kalır → UI "Veri yok" badge gösterir.
-- Bu, stale-data check'in doğru çalışması için zorunludur.
-- enriched_at kolonundan AYRI — enriched_at "keyword data vardı" anlamına gelir,
-- dfs_fetched_at "DataForSEO'dan ne zaman çekildi" anlamına gelir.
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS dfs_fetched_at TIMESTAMPTZ;

-- İndeks: stale check sorguları için (project bazlı keyword freshness scan)
CREATE INDEX IF NOT EXISTS idx_keywords_dfs_fetched_at
  ON public.keywords(project_id, dfs_fetched_at)
  WHERE dfs_fetched_at IS NOT NULL;
