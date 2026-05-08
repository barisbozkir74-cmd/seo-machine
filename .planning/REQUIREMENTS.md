# Requirements — v4.0 AI-Powered Project Intelligence Layer

## Milestone Goal

Proje bilgilerinden otomatik başlayan, sektör araştırması yapan ve keyword stratejisi kuran AI-driven akış — site blueprint'e kadar uçtan uca.

---

## v4.0 Requirements

### Proje Başlatma Gate

- [x] **PROJ-06**: Kullanıcı, tüm zorunlu proje alanları doldurulduğunda "Projeyi Başlat" butonunu aktif görür
- [x] **PROJ-07**: "Projeyi Başlat" tetiklenince sektör araştırması otomatik başlar (yeni proje + WP import)

### Sektör Araştırması

- [x] **SRCH-01**: Sistem proje bilgilerindeki sektör + rakipler + ana keywordlerden Google arama sorguları otomatik oluşturur
- [x] **SRCH-02**: Arama sonuçları parse edilerek pazar özeti, rakip konumları, sektör açıkları ve fırsatlar raporu üretilir
- [x] **SRCH-03**: Kullanıcı araştırma raporunu projeye ait dedicated bölümde görüntüler ve notlar ekleyebilir

### AI Keyword Stratejisi

- [ ] **KWST-01**: Proje rakiplerinin kullandığı keywordler DataForSEO ile otomatik çekilir
- [ ] **KWST-02**: Ana keywordler + rakip keywordler + ilişkili genişletmelerden birleşik keyword havuzu oluşturulur
- [ ] **KWST-03**: AI keyword havuzunu gruplar ve kullanıcıya gruplama önerileri sunar
- [ ] **KWST-04**: Kullanıcı önerilen grupları kabul/red/düzenleyebilir; onaylananlar keyword tablosuna işlenir
- [ ] **KWST-05**: Mevcut CSV import akışı korunur ve AI keyword akışıyla birlikte çalışır

### Site Blueprint Gate

- [ ] **BLUE-06**: Onaylanan keyword stratejisinden "Sistemi Kur" tetiklenince site blueprint otomatik oluşturulur

### Carry-overlar (v3.0'dan devir)

- [ ] **MON-03**: Monitoring dashboard + imported pages entegrasyonu
- [ ] **PAGE-05**: Revision history — her sayfa paketinin geçmiş versiyonları

---

## Future Requirements (Deferred)

- AI chat copilot panel — her sayfada bağlam-duyarlı AI asistan (v5.0+)
- Multi-tenant SaaS dönüşümü — çok ajans desteği (kapsam dışı, Out of Scope)

---

## Out of Scope

- **Chatbot / serbest konuşma arayüzü** — Bu milestone'da yok; structured AI workflow tercih edildi
- **Multi-tenant SaaS** — Başlangıçta tek ajans kullanımı

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PROJ-06 | Phase 18 | Complete |
| PROJ-07 | Phase 18 | Complete |
| SRCH-01 | Phase 18 | Complete |
| SRCH-02 | Phase 18 | Complete |
| SRCH-03 | Phase 18 | Complete |
| KWST-01 | Phase 19 | Pending |
| KWST-02 | Phase 19 | Pending |
| KWST-05 | Phase 19 | Pending |
| KWST-03 | Phase 20 | Pending |
| KWST-04 | Phase 20 | Pending |
| BLUE-06 | Phase 21 | Pending |
| MON-03 | Phase 22 | Pending |
| PAGE-05 | Phase 22 | Pending |
