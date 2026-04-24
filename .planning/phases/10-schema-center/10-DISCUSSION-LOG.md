# Phase 10: Schema Center - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 10-schema-center
**Areas discussed:** Tab Mimarisi, Üretim Mekanizması, Generation Trigger, Schema Editör UI

---

## Tab Mimarisi

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece Schema sekmesi | Mevcut scroll form korunur. Üste "Paket" ve "Schema" sekmeleri eklenir. Minimal değişiklik. | ✓ |
| Tüm editor sekmelere bölünsün | Mevcut form bölümleri sekmelere taşınır (Meta, İçerik, Schema vb.). Daha organize ama daha büyük refactor. | |

**User's choice:** Sadece Schema sekmesi
**Notes:** Minimal refactor tercih edildi. Mevcut scroll form dokunulmadan korunur.

---

## Üretim Mekanizması

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side template | page_type'a göre sabit template'ler. Hızlı, AI harcaması yok. | ✓ |
| AI generation | Claude API ile akıllı JSON-LD üretimi. Daha zengin ama API harcaması var. | |
| Template + AI refinement | Önce template, isteğe bağlı AI iyileştirme. | |

**User's choice:** Client-side template
**Notes:** AI harcaması olmadan hızlı, deterministik üretim yeterli.

---

## Generation Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Ayrı Schema Üret butonu | Schema sekmesinde bağımsız buton. | ✓ |
| AI ile Üret'e entegre | Mevcut AI generate aynı zamanda schema'yı da doldurur. | |
| Her ikisi | AI ile Üret schema_type'u, Schema sekmesinde ayrı buton JSON-LD'yi oluşturur. | |

**User's choice:** Ayrı Schema Üret butonu
**Notes:** Bağımsız akış, kullanıcı istediğinde tetikler.

---

## Schema Editör UI

| Option | Description | Selected |
|--------|-------------|----------|
| Mono Textarea | Mevcut Field bileşeni, mono prop. Sıfır bağımlılık, tutarlı. | ✓ |
| Syntax highlighted editor | CodeMirror/Monaco. Zengin ama yeni bağımlılık. | |

**User's choice:** Mono Textarea
**Notes:** Mevcut JSON alanlarıyla (heading_hierarchy, faq) tutarlı pattern korundu.

---

## Claude's Discretion

- Template output'un opsiyonel alanları (publisher, logo, datePublished) dahil etme
- Mevcut schema varken "Schema Üret" tetiklendiğinde üzerine yazma uyarısı
- Kopyala feedback animasyon süresi

## Deferred Ideas

- AI-driven schema refinement — ileride Phase 11+
- JSON-LD schema validation (schema.org uyumluluğu) — Phase 11 QA scoring ile değerlendirilebilir
- Rich schema types (BreadcrumbList, SiteLinksSearchBox vb.)
