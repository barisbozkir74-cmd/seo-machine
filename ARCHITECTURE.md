# SEO Machine — Guard Architecture

## Decision Conflict Guard

AI çıktıları DB'ye yazılmadan önce `project_decisions` tablosundaki kilitli kararlarla karşılaştırılır.
Çakışma tespit edilirse write bloklanır ve istemciye 409 döner.

### Guard katmanları

| Katman | Fonksiyon | Davranış |
|---|---|---|
| Rule-based (pre-write) | `checkConflicts()` | Aynı section+decision_type'da kilitli karar varsa bloklar |
| Pattern-based (post-AI) | `checkOutputAgainstLockedDecisions()` | AI çıktı metnini `direct_negation` + `domain_conflict` kurallarıyla tarar |

### Fail-open vs Fail-close

**Fail-open**: guard crash ederse write devam eder.  
**Fail-close**: guard crash ederse write bloklanır (503 GUARD_ERROR).

| Endpoint | Guard tipi | Davranış | Wave |
|---|---|---|---|
| `POST /api/research/analyze` | Rule-based (pre-write) + pattern (fire-and-forget) | Kural çakışması → 409; pattern guard fire-and-forget | Wave E |
| `POST /api/keywords/strategy` | Pattern (post-AI) | Violation → 409; crash → 503 GUARD_ERROR | Wave E→G |
| `POST /api/content/generate` | Pattern (post-AI) | Violation → 409; crash → 503 GUARD_ERROR | Wave F |
| `POST /api/ai/qa-audit` | Pattern (post-AI) | Violation → 409; crash → 503 GUARD_ERROR | Wave G |
| `POST /api/keywords/expand` | Pattern (post-AI) | Violation → 409; crash → 503 GUARD_ERROR | Wave H |
| `POST /api/ai/generate-page-package` | Pattern (pre-stream, page metadata) | Violation → 409; crash → 503 — stream başlamaz | Wave H |

`/api/keywords/strategy` Wave E'de fail-open olarak teslim edildi (`.catch(() => null)`).
Wave G'de fail-close'a yükseltildi — guard crash artık üretimi bloklıyor.

`/api/ai/generate-page-package` streaming route'tur. Post-stream guard response'u geri alamaz.
Wave H'de pre-stream guard eklendi: sayfa metadatası (title, slug, page_type, focusKeyword)
stream açılmadan kontrol edilir. Violation veya crash → stream asla başlamaz.

### Kritik karar tipleri

`CRITICAL_DECISION_TYPES = ['architecture', 'strategy', 'brand']`

Bu tiplerdeki kilitli kararlarla çakışan AI çıktıları tüm fail-close endpoint'lerde kesinlikle bloklanır.

### Guard crash davranışı ve alert stratejisi

Guard crash (timeout, servis hatası, vs.) gerçekleştiğinde:

1. `logGuardFailure(endpoint, error)` çağrılır → `[GUARD_FAILURE] <endpoint>: <message>` formatında `console.error`
2. Çağıran route 503 döner (fail-close endpoint'lerde)
3. İstemci `{ code: 'GUARD_ERROR' }` alır

Log formatı (Wave H structured): `[GUARD_FAILURE] endpoint=keywords/expand decision_type=strategy conflict_count=1 ts=2026-06-03T00:00:00.000Z: guard timeout`

Prodüksiyonda bu loglar uygulama log aggregator'ına (Vercel, Datadog, vs.) akar.
Alert kuralı önerisi: 5 dakikada 3+ `[GUARD_FAILURE]` → PagerDuty/Slack bildirimi.

### `guard-policy.ts` API

```typescript
// Hangi endpoint'ler fail-close?
shouldFailClose(endpoint: string): boolean

// Guard crash sonrası log
logGuardFailure(endpoint: string, error: unknown): void

// Kritik karar tipleri
CRITICAL_DECISION_TYPES: readonly ['architecture', 'strategy', 'brand']

// Fail-close endpoint listesi
FAIL_CLOSE_ENDPOINTS: readonly ['content/generate', 'keywords/strategy', 'ai/qa-audit', 'keywords/expand', 'ai/generate-page-package']
```

### Yeni endpoint ekleme kuralı

Yeni bir AI write endpoint'i eklerken:

1. `checkOutputAgainstLockedDecisions()` ekle
2. Fail-close için: `try/catch` + `logGuardFailure` + 503 → `FAIL_CLOSE_ENDPOINTS`'e ekle
3. Smoke test yaz: violation→409, crash→503, pass→200, write-blocked doğrulama
