-- research_reports: (project_id, section) üzerinde unique constraint
-- runSectorResearch() saveReport() fonksiyonunda onConflict: 'project_id,section' kullanıyor
ALTER TABLE public.research_reports
  ADD CONSTRAINT research_reports_project_section_unique UNIQUE (project_id, section);
