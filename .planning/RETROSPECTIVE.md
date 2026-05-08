# Retrospective — SEO Machine

Living retrospective. Updated after each milestone close.

---

## Milestone: v3.0 — Autonomous Growth Layer

**Shipped:** 2026-05-08
**Phases:** 7 (12, 13, 14, 15, 15.5, 16, 17) | **Plans:** 35 | **Commits:** 192 | **Timeline:** 12 days

### What Was Built

- Content Studio: Heading bazlı bölüm-bölüm AI içerik üretimi, onay/ret akışı, streaming UI
- WordPress Publishing: REST API draft/publish/scheduled; tam SEO payload (meta, JSON-LD)
- GSC Integration: OAuth PKCE flow, index durumu, keyword/sayfa performans verisi
- Monitoring Dashboard: Cluster trafik özeti, decay alert sistemi, period tabs
- WordPress Site Import Engine: WP crawl → normalize → tree → GSC eşleme → AI intent → audit flags
- Recovery Engine: n8n webhook tabanlı daily decay tespiti, weak_page kombinasyonu
- Keyword Intelligence: calculateNicheScore (4 faktör, 0-100), classifyRevenueType, cluster panel UI

### What Worked

- **Code review + fix workflow**: Her fazda kod incelemesi yapıldı, WR-01–04 hataları code review fix planlarıyla temizlendi
- **Phase 15.5 insertion**: Recovery Engine'in bağımlılığı ortaya çıkınca Phase 15.5 milestone sırasına eklendi — decimal phase pattern iyi çalıştı
- **Claude claude-sonnet-4-6 consistency**: Tüm AI üretim (content studio, AI intent, niche score) tek model üzerinden yapıldı — prompt pattern'ları tekrar kullanılabildi
- **Supabase secrets pattern**: WP credentials ve GSC tokens için server-only vault pattern tutarlı uygulandı
- **n8n webhook isolation**: Recovery Engine tamamen ayrı endpoint olarak tasarlandı — diğer fazları etkilemeden entegre edildi

### What Was Inefficient

- **REQUIREMENTS.md hiç güncellenmedi**: Tüm fazlar execute edildi ama traceability tablosu "Pending" kaldı — milestone close'da toptan düzeltildi. Gelecekte her faz sonunda traceability güncellenebilir.
- **ROADMAP.md boş kaldı**: Sıfır içerik ile 17 faza ulaşıldı. Roadmap yazma adımı atlandı. Milestone close'da inşa edildi.
- **30 deferred UAT/verification items**: UAT ve verification dosyaları oluşturuldu ama "human_needed" veya "partial" durumda bırakıldı. Bu öncelikli olarak ele alınabilirdi.
- **STATE.md stale fields**: Birden fazla alanda placeholder değerler (`--phase`, `--stopped-at`) bırakıldı — sadece milestone close'da temizlendi.

### Patterns Established

- **HMAC authentication**: n8n webhook endpointleri HMAC ile güvence altına alındı — future webhook'lar için pattern
- **Middleware bypass pattern**: `/api/gsc/sync` ve `/api/recovery/detect` için middleware early-exit pattern — server-to-server endpointlerde tekrarlanabilir
- **Parallel Promise.all SSR**: Monitoring dashboard çift tablo fetch için — diğer aggregate data sayfalarında kullanılabilir
- **Background import + polling**: Phase 15.5 import işlemi background + `/api/wp/import-status` polling — uzun işlemler için referans pattern
- **Decimal phase insertion**: Phase 15.5, milestone bitmeden milestone sırasına eklendi — bağımlılık yönetimi için sağlıklı bir yol

### Key Lessons

1. **Traceability sürekli güncellenmeli**: Sadece milestone close'da değil, faz tamamlandıktan sonra hemen güncellenmeli
2. **ROADMAP.md'yi ilk fazda yaz**: Sonradan inşa etmek milestone close'u zorlaştırdı
3. **UAT'ı execution ile birlikte tamamla**: "Partial" UAT'lar birikince zorlaşıyor — her plan execute edilirken UAT senaryoları da geçilmeli
4. **Decimal phase bağımlılık kırma**: Bir fazdaki bağımlılık zinciri kırıldığında decimal faz eklemek yerine önce dependency'yi tamamlamak daha az risk taşır

### Cost Observations

- Model: Claude claude-sonnet-4-6 (tüm execution)
- AI kullanım alanları: İçerik üretimi, AI intent analizi, kod üretimi, kod inceleme, planlama
- 35 plan / 12 gün = ~2.9 plan/gün

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Plans/Day |
|-----------|--------|-------|------|-----------|
| v3.0 Autonomous Growth Layer | 7 | 35 | 12 | ~2.9 |

*Geçmiş milestonelar (v1.0, v2.0) bu dosya oluşturulmadan tamamlandı — v4.0'dan itibaren her milestone sonrası güncellenir.*
