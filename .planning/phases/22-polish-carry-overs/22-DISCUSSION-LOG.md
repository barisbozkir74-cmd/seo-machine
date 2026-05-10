# Phase 22 — Discussion Log

**Date:** 2026-05-10
**Phase:** 22 — Polish & Carry-overs
**Requirements:** MON-03, PAGE-05

---

## MON-03: Monitoring + Imported Pages

### Q1: Imported pages izleme sayfasında nasıl görünmeli?
**Options:** Mevcut 'Sayfalar' sekmesine eklenir / Ayrı yeni bir 'Import' sekmesi / Cluster özetlerine dahil edilir (sadece sayı olarak)
**Answer:** Mevcut 'Sayfalar' sekmesine eklenir
**Decision:** D-01

### Q2: GSC bağlantısı olmayan bir proje izleme sayfasını açınca imported pages görünsün mü?
**Options:** Evet, GSC olmadan da görünsün / Hayır, mevcut GSC gate korunsun
**Answer:** Evet, GSC olmadan da görünsün
**Decision:** D-02

### Q3: Cluster özetleri (kümeler sekmesi) imported pages'i nasıl görsün?
**Options:** Imported pages cluster özetine dahil edilmez / Kümeler sekmesinde 'Bağlanmamış' satırı eklenir
**Answer:** Imported pages cluster özetine dahil edilmez
**Decision:** D-03

---

## PAGE-05: Revision History

### Q4: Sayfa paketi için revision ne zaman oluşturulmalı?
**Options:** Her 'Kaydet' aksiyonunda otomatik / Sadece manuel 'Sürüm Oluştur' butonu / İlk kez yayınlanınca
**Answer:** Her 'Kaydet' aksiyonunda otomatik
**Decision:** D-04

### Q5: Revision geçmişi listesi sayfa-paketi UI'ında nerede durmalı?
**Options:** Sağ panelde editörün altında / Sağ panelde üstte tab olarak / Drawer/sheet — 'Geçmiş' butonu sağ üstte açar
**Answer:** Drawer / sheet olarak — 'Geçmiş' butonu sağ üstte açar
**Decision:** D-05

### Q6: 'Geri yükle' aksiyonu ne yapmalı?
**Options:** Editörü o versiyonla doldurur, kaydetmeden önce onay ister / Anında overwrite eder ve otomatik kaydeder / Preview gösterir, kullanıcı 'Bunu Yükle' ile onaylar
**Answer:** Preview gösterir, kullanıcı 'Bunu Yükle' ile onaylar
**Decision:** D-06
