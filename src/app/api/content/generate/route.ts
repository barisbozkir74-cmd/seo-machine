import { createClient } from '@/lib/supabase/server'
import { ContentGenerateSchema } from '@/lib/schemas/content'
import { generateContentObject, type ContentObjectInput } from '@/services/seo/content/contentOrchestrator'
import { logEvent } from '@/services/event-service'
import { ok, err } from '@/lib/api/response'
import { type PageType } from '@/services/seo/site/pageMappingService'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { logGuardFailure } from '@/core/decision/guard-policy'

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHORIZED', 'Not authenticated', 401)

  const body = await request.json().catch(() => null)
  const parsed = ContentGenerateSchema.safeParse(body)
  if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)

  const { project_id, page_id } = parsed.data

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()
  if (!project) return err('NOT_FOUND', 'Project not found', 404)

  const { data: page, error: pageErr } = await supabase
    .from('pages')
    .select('id, site_id, page_type, primary_keyword, intent, opportunity_score, keyword_set')
    .eq('id', page_id)
    .eq('project_id', project_id)
    .single()
  if (pageErr || !page) return err('NOT_FOUND', 'Page not found', 404)
  if (!page.site_id) return err('PRECONDITION_FAILED', 'Page has no site. Run site generation first.', 422)

  const siteId = page.site_id as string

  // Homepage page ID for link cap enforcement (stored as ID, slug resolved at publish time)
  const { data: homepagePage } = await supabase
    .from('pages')
    .select('id')
    .eq('site_id', siteId)
    .eq('url', '/')
    .single()
  const homepagePageId = (homepagePage as { id: string } | null)?.id ?? ''

  // Fetch outgoing Phase 3 links for this page — stored as page IDs, never slugs
  const { data: linkRows } = await supabase
    .from('internal_links')
    .select('to_page_id, anchor_text, link_type')
    .eq('from_page_id', page_id)

  const existingLinks = (linkRows ?? [])
    .map(l => {
      const row = l as { to_page_id: string; anchor_text: string; link_type: string }
      if (!row.to_page_id) return null
      return { to_page_id: row.to_page_id, anchor_text: row.anchor_text, link_type: row.link_type }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  // Site-scope duplicate title check — latest active versions only
  const { data: sitePageRows } = await supabase
    .from('pages')
    .select('id')
    .eq('site_id', siteId)
  const sitePageIds = (sitePageRows ?? []).map(p => (p as { id: string }).id)

  const { data: titleRows } = await supabase
    .from('content')
    .select('title')
    .in('page_id', sitePageIds)
    .neq('page_id', page_id)
    .eq('status', 'active')
  const allSiteTitles = (titleRows ?? []).map(r => (r as { title: string }).title)

  // Next version: MAX(version) + 1
  const { data: versionRow } = await supabase
    .from('content')
    .select('version')
    .eq('page_id', page_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = ((versionRow as { version: number } | null)?.version ?? 0) + 1

  const input: ContentObjectInput = {
    page_id,
    page_type:         page.page_type as PageType,
    primary_keyword:   page.primary_keyword as string,
    intent:            page.intent as string,
    opportunity_score: (page.opportunity_score as number) ?? 0,
    keyword_variants:  (page.keyword_set as string[]) ?? [],
    existing_links:    existingLinks,
    homepage_page_id:  homepagePageId,
    all_site_titles:   allSiteTitles,
  }

  let output
  try {
    output = await generateContentObject(input)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Content generation failed'
    return err('GENERATION_ERROR', message, 500)
  }

  // Conflict guard — kilitli kararlarla çakışan içerik bloklanır (fail-close)
  // keywords/strategy'nin aksine guard crash da bloklayıcıdır: içerik güvenlik kontrolü atlanamaz.
  const contentText = [output.title, output.h1, output.meta_description].filter(Boolean).join(' ')
  let guardResult: Awaited<ReturnType<typeof checkOutputAgainstLockedDecisions>> | null = null
  try {
    guardResult = await checkOutputAgainstLockedDecisions(supabase, project_id, user.id, contentText, 'icerik-studio')
  } catch (guardError) {
    logGuardFailure('content/generate', guardError)
    return err('GUARD_ERROR', 'İçerik güvenlik kontrolü başarısız — içerik kaydedilmedi', 503)
  }
  if (!guardResult.passed) {
    return err('DECISION_CONFLICT', 'İçerik kilitli kararlarla çakışıyor — içerik kaydedilmedi', 409)
  }

  // Archive current active version before inserting new one
  await supabase
    .from('content')
    .update({ status: 'archived' })
    .eq('page_id', page_id)
    .eq('status', 'active')

  // Insert new version (immutable row — updated_at = created_at = now())
  const { data: inserted, error: insertErr } = await supabase
    .from('content')
    .insert({
      page_id,
      project_id,
      user_id:              user.id,
      title:                output.title,
      meta_title:           output.meta_title,
      meta_description:     output.meta_description,
      h1:                   output.h1,
      h2_structure:         output.h2_structure,
      body_content:         output.body_content,
      faq_section:          output.faq_section,
      internal_links:       output.internal_links,
      seo_score:            output.seo_score,
      readability_score:    output.readability_score,
      intent_match_score:   output.intent_match_score,
      internal_link_score:  output.internal_link_score,
      word_count:           output.word_count,
      status:               'active',
      version:              nextVersion,
    })
    .select('id, version')
    .single()
  if (insertErr || !inserted) return err('DB_ERROR', insertErr?.message ?? 'Content insert failed', 500)

  const contentId = (inserted as { id: string; version: number }).id

  // Write validation report
  await supabase.from('validation_reports').insert({
    content_id:           contentId,
    page_id,
    project_id,
    user_id:              user.id,
    validation_passed:    output.validation_passed,
    report_json: {
      passed: output.validation_passed,
      errors: output.validation_errors,
      scores: {
        seo_score:            output.seo_score,
        readability_score:    output.readability_score,
        intent_match_score:   output.intent_match_score,
        internal_link_score:  output.internal_link_score,
      },
    },
    seo_score:            output.seo_score,
    readability_score:    output.readability_score,
    intent_match_score:   output.intent_match_score,
    internal_link_score:  output.internal_link_score,
  })

  await logEvent(supabase, {
    userId:     user.id,
    actionType: 'metadata_generated',
    projectId:  project_id,
    payload:    { page_id, meta_title: output.meta_title },
  })
  await logEvent(supabase, {
    userId:     user.id,
    actionType: 'content_generated',
    projectId:  project_id,
    payload:    { page_id, word_count: output.word_count, version: nextVersion },
  })
  await logEvent(supabase, {
    userId:     user.id,
    actionType: 'validation_completed',
    projectId:  project_id,
    payload:    { page_id, seo_score: output.seo_score, validation_passed: output.validation_passed },
  })

  return ok({
    content_id:           contentId,
    page_id,
    version:              nextVersion,
    seo_score:            output.seo_score,
    readability_score:    output.readability_score,
    intent_match_score:   output.intent_match_score,
    internal_link_score:  output.internal_link_score,
    word_count:           output.word_count,
    validation_passed:    output.validation_passed,
    validation_errors:    output.validation_errors,
  }, 201)
}
