# Ev Ustası — Yol Haritası ve Yapılacaklar Listesi

> Oluşturma: 2026-06-12 | Durum: **yaşayan doküman** — görev bitince işaretle, faz kapanınca "Geçiş kriteri" satırını doğrula.
> Kaynaklar: `gdd/home-makeover/08-milestones.md` (H1–H13 planı), `docs/2026-06-12-engine-decision.md` (stack), CLAUDE.md agent tablosu.
> Hafta numaraları (H1–H13) GDD ile birebir eşleşir; fazlar bu haftaların gruplanmış hâlidir.

## Fazlara genel bakış

| Faz | Haftalar | Odak | Birincil agent'lar | Kapı |
| --- | --- | --- | --- | --- |
| 0 — Kurulum & kapılar | H1 | Motor, iskelet, pipeline, tasarım kapıları | tech-architect¹, asset-pipeline, scene-3d-dev, qa-poki | Motor kararı + kapı sonuçları |
| 1 — Riskli çekirdek | H2–H4 | Yerleştirme, temizlik, twist (en riskli 3 varsayım) | gameplay-dev, scene-3d-dev, ui-dev, juice-audio-dev | L9 testi iç oynamada geçiyor |
| 2 — Döngü kapanışı | H5–H6 | Boya, teslim, katalog, save, FTUE → **dikey dilim** | gameplay-dev, ui-dev, juice-audio-dev, qa-poki | Kalite kapısı 1: dış test |
| 3 — Denge & içerik | H7–H8 | Geri bildirim, balance v1, 2. mahalle, Design Rank | gameplay-dev, asset-pipeline, systems-balancer¹ | MVP içerik kapsamı yerinde |
| 4 — Poki & cila | H9–H11 | SDK + rewarded, görsel geçiş, juice/SFX tamamı, perf bütçesi | qa-poki, ui-dev, scene-3d-dev, juice-audio-dev, asset-pipeline | Alt segment akıcı; ilk yük hedefte |
| 5 — Yayın | H12–H13 | Playtest, denge 2, final gate, gönderim | qa-poki (lider), tüm dev agent'lar, design-critic¹ | Poki'ye gönderim |

¹ GameDesign deposundaki tasarım agent'ları (tech-architect, market-analyst, design-critic, systems-balancer) orada koşulur; bu depo çıktılarını tüketir.

---

## Faz 0 — Kurulum & kapılar (H1)

**Amaç:** Kod yazımına engel tüm kararlar kapanır; bir Kenney odası mobilde 60 fps render edilir.

- [x] 3DGameDev deposu + CLAUDE.md/MEMORY.md + 6 dev agent kurulumu (2026-06-12)
- [x] GDD taslak v0.1'in `gdd/home-makeover/` altına taşınması (2026-06-12)
- [x] Motor analizi: Three.js vs Babylon.js → `docs/2026-06-12-engine-decision.md` (2026-06-12)
- [x] Motor kararı onayı (Emre, 2026-06-12): **Three.js kesin** — GDD 00-overview açık sorusu kapatıldı, 08-milestones işlendi
- [ ] Tasarım kapıları (GameDesign deposunda): `market-analyst` doygunluk taraması + `design-critic` GDD gate → revizyon listesi buraya işlenir
- [x] Proje iskeleti: Vite + TypeScript, `src/` yapısı (M1–M9 saf TS modülleri + `scene/` orkestratör sınırı) — *gameplay-dev + scene-3d-dev* (2026-06-12: `three@0.184.0` pinli, strict TS, build 126,7 KB gzip — not: `docs/2026-06-12-project-skeleton.md`)
- [ ] Asset pipeline ilk halkası: `tools/` altında `@gltf-transform/cli` (meshopt + KTX2 + prune), manifest + lisans kaydı şablonu — *asset-pipeline*
- [ ] Kenney kit envanteri: Modular Buildings + Furniture + Food yeterlilik raporu + eksik asset listesi (öncelik: müşteri karakteri durumu) — *asset-pipeline*
- [ ] İlk render testi: 1 oda + ~10 mobilya GLB → sıkıştırma → yükleme → InstancedMesh — *scene-3d-dev*
- [ ] Teknik spike 1: sürt-sil maskesi (render-target fırça + decal shader) — H3 riskini öne çeker — *scene-3d-dev*
- [ ] Teknik spike 2: 4 açılı kamera rig'i + duvar saydamlaştırma (dik kadraj okunabilirliği) — *scene-3d-dev*
- [ ] Mobil ölçüm raporu: gerçek orta seviye Android/Chrome'da fps + ilk yük boyutu + ilk ekran süresi — *qa-poki*

**Geçiş kriteri:** Motor kararı verili; bir Kenney odası mobilde 60 fps; iki spike'tan "kararı geri döndürecek sinyal" çıkmadı; kapı sonuçları işlendi.
**Not:** Kapılar "kırmızı" derse Faz 1 işleri büyük ölçüde tema-bağımsızdır (3D yerleştirme + sürt-sil her dekorasyon temasında yaşar) — pivot maliyeti içerik katmanında kalır.

## Faz 1 — Riskli çekirdek (H2–H4)

**Amaç:** Projenin en riskli üç varsayımı oynanır hâle gelir: tek-parmak 3D yerleştirme, sürt-sil hissi, twist okunabilirliği.

### H2 — Yerleştirme sistemi (en riskli UX)

- [ ] Grid + duvar/yüzey çapaları, hayalet (ghost), snap, döndürme, store mantığı (M4 modülü) — *gameplay-dev*
- [ ] Raycast + pointer event sarmalayıcısı (Babylon PointerDragBehavior telafisi, bir kez yazılır) — *scene-3d-dev*
- [ ] 4 açılı kamera + duvar saydamlaştırma entegrasyonu (spike'tan üretime) — *scene-3d-dev*
- [ ] Tek parmak sürükleme input şeması, dikey/yatay layout iskeleti — *ui-dev*
- [ ] Cihaz testi: dik telefonda yerleştirme "iyi hissettiriyor" mu — *qa-poki*

### H3 — Temizlik

- [ ] Kir maskesi sürt-sil (≤ 1 kare gecikme) + çöp toplama (M2 modülü) — *gameplay-dev + scene-3d-dev*
- [ ] Faz durum makinesi (clean/paint/furnish/deliver) + faz sekmeleri (01 akışı) — *gameplay-dev + ui-dev*
- [ ] Sürtme partikülü + ilk SFX entegrasyonu, ses sistemi kararı (Howler.js vs ince WebAudio) — *juice-audio-dev*
- [ ] Alt segment sürt-sil performans testi (maske çözünürlüğü fallback'i hazır) — *qa-poki*

### H4 — Twist çekirdeği

- [ ] Etiket sistemi + puan hesabı + Hidden Wish (M5 modülü; sayılar `balance/parameters.md`'den) — *gameplay-dev*
- [ ] Taste Meter HUD + müşteri kartı + nedenli puan etiketleri — *ui-dev*
- [ ] Canlı tepki sunumu: 2D emote balon fallback'i + tepki tween'leri — *juice-audio-dev*
- [ ] Zincir gecikme ölçümü: yerleştir → tepki → metre ≤ 0,5 sn — *qa-poki*

**Geçiş kriteri:** L9 testi iç oynamada geçiyor (oyuncu hangi eşyanın neden puan getirdiğini doğru açıklıyor); üç riskli varsayım da mobilde doğrulandı.

## Faz 2 — Döngü kapanışı → dikey dilim (H5–H6)

**Amaç:** Tam iş döngüsü uçtan uca kapanır; dikey dilim dış teste çıkar.

### H5 — Döngünün kalan halkaları

- [ ] Boya sistemi + yüzeyler (M3) — *gameplay-dev + scene-3d-dev*
- [ ] Teslim sekansı + yıldız + ödeme (M6) — *gameplay-dev*
- [ ] Job Board + müşteri kartı akışı (M1) — *gameplay-dev + ui-dev*
- [ ] Teslim kutlaması juice'u (konfeti, puan uçuşması) — *juice-audio-dev*

### H6 — Dikey dilim tamamlama

- [ ] Katalog + aletler (M7): Starter Set + 5–8 satın alınabilir eşya — *gameplay-dev + ui-dev*
- [ ] Save sistemi (M9): sürümlenmiş localStorage JSON + migration alanı — *gameplay-dev*
- [ ] FTUE ilk 30 sn, 05-ux-ui tablosuna birebir — *ui-dev*
- [ ] Dilim içeriği: "Maple Street" 3 iş, 3 arketip (Grandma Rose, The Bookworm, The Minimalist) — *gameplay-dev + asset-pipeline*
- [ ] Dikey dilim denetimi: GDD sadakati + perf ölçümü — *qa-poki*

**Geçiş kriteri (kalite kapısı 1):** Dış test (2–3 kişi, ≥1 mobil): ilk sürtme < 5 sn; L9 testi geçiyor; ilk teslim < 4 dk; "bir iş daha" isteği kendiliğinden doğuyor. Ardından `design-critic` ara bakışı (GameDesign).

## Faz 3 — Denge & içerik genişletme (H7–H8)

**Amaç:** Dilim geri bildirimi işlenir; MVP içerik kapsamına ulaşılır.

- [ ] Dış test geri bildirimlerinin işlenmesi (öncelik sırası qa-poki raporundan) — *ilgili dev agent'lar*
- [ ] `systems-balancer` simülasyonları (GameDesign) → `balance/parameters.md` v1; data modülleri eşitlenir — *gameplay-dev*
- [ ] "Riverside Lofts" mahallesi: yeni işler, kategoriler, arketipler (04-content) — *gameplay-dev + asset-pipeline*
- [ ] Design Rank + milestone seti (M8) — *gameplay-dev + ui-dev*
- [ ] Yeni asset'lerin sıkıştırma + lazy-load gruplarına eklenmesi, manifest güncellemesi — *asset-pipeline*
- [ ] Pacing/3★ erişilebilirliği ilk doğrulama — *qa-poki*

**Geçiş kriteri:** 12–15 iş, 8–9 kategori, 6–8 arketip yerinde; 3★ hedefleri simülasyonla doğrulanmış.

## Faz 4 — Poki entegrasyonu & cila (H9–H11)

**Amaç:** Yayın gereklilikleri (SDK, reklam, görsel kalite, performans bütçesi) kapanır.

### H9 — Poki SDK

- [ ] Poki SDK entegrasyonu + `commercialBreak` (yalnız teslim sonrası) + adblock/fallback davranışları — *qa-poki + gameplay-dev*
- [ ] 5 rewarded yerleşim (GDD 07) + opt-in teklif arayüzleri — *ui-dev + gameplay-dev*

### H10 — Görsel geçiş

- [ ] Işık/palet düzeni + oda set dressing — *scene-3d-dev*
- [ ] Müşteri karakterleri + emote'lar **veya** fallback kararının kesinleşmesi (kesilebilir #4) — *asset-pipeline + scene-3d-dev*
- [ ] Placeholder'ların emekli edilmesi — *asset-pipeline*

### H11 — Juice & performans bütçesi

- [ ] GDD 06 juice/SFX tablosunun tamamı + 1 müzik loop'u — *juice-audio-dev*
- [ ] GLB sıkıştırma turu, kategori/mahalle lazy-load, FTUE odası minimal paket — *asset-pipeline*
- [ ] Alt segment cihaz testi: 30 fps taban, ilk paket < 5 MB, ilk ekran < 3 sn — *qa-poki*

**Geçiş kriteri:** Teklif akışları uçtan uca; alt segment mobilde akıcı; ilk yük hedefte.

## Faz 5 — Test & yayın (H12–H13)

**Amaç:** Gerçek oyuncu verisiyle son denge; Poki gönderimi.

- [ ] Denge turu 2 (gerçek oturum verisiyle) — *gameplay-dev*
- [ ] Playtest: 5+ kişi, ≥2 mobil; retention/pacing gözlemleri — *qa-poki*
- [ ] Hata temizliği — *tüm dev agent'lar*
- [ ] `design-critic` final gate (GameDesign) + "Hillside Villas" durum kararı
- [ ] Poki QA hazırlığı: yayın öncesi uyumluluk kontrol listesi, build/submission — *qa-poki*

**Geçiş kriteri:** Poki'ye gönderim yapıldı. (Poki inceleme süresi plan dışı tutulur — 08 açık sorusu.)

---

## Kesilebilirler (kapsam daralırsa, sıralı)

GDD 08 §4'tekiyle aynı; üstteki önce kesilir: Hillside Villas → Cat Person quirk asset'leri → R5/R4 rewarded'lar → müşteri animasyonları (fallback'e düş) → Kitchen & Table Props → Rugs alt katman kuralı → ambiyans sesleri → pinch zoom → commercialBreak.
**Kesilemezler:** canlı müşteri tepkisi + nedenli puan etiketi, sürt-sil ≤ 1 kare, FTUE ilk 30 sn, grid-snap, sürümlenmiş save, R1+R2.

## Öneriler (plan dışı, Emre'nin değerlendirmesine)

1. ~~**Git deposu başlatılmalı (Faz 0, hemen).**~~ ✅ Yapıldı (2026-06-12): `main` dalında ilk commit (`ed0c85f`, 22 dosya) + `.gitignore`/`.gitattributes`. Haftalık "oynanır build" ritmi tag'lerle izlenebilir.
2. **Performans ölçüm günlüğü standardı:** qa-poki her faz kapanışında aynı şablonla ölçsün (fps, gzip paket boyutu, ilk ekran süresi, draw call) → `docs/perf-log.md`. H11'de sürprizle karşılaşmamanın tek yolu trendi baştan izlemek (L8).
3. **Kenney envanteri Faz 0'da öne alındı** (GDD'de örtük, burada açık görev): en yüksek asset riski müşteri karakterleri — fallback kararı H10'a kalmadan veri toplanmış olur.
4. **İngilizce yayın adı araştırması H8–H9 arasına yerleştirilmeli** (MEMORY açık kararı): Poki SDK entegrasyonu ve store metinleri başlamadan ad kesinleşmeli. GameDesign'da market-analyst'e kısa bir ad/doygunluk taraması açılabilir.
5. **Playtest havuzu erken kurulsun (Faz 2'den itibaren):** 08 açık sorusu — önceki oyunun öğrenci çevresi bu türün kitlesiyle örtüşmeyebilir; dikey dilim dış testinde (H6) aynı havuz kullanılacağı için aramaya H12'de değil şimdi başlamak ucuz.
6. **Takvim çakışması kararı (Power City) Faz 0 blokeriyle birlikte verilmeli:** H1 kurulum işleri Power City yayın beklerken öne alınabilir (08 risk tablosu) — motor onayıyla aynı oturumda netleşirse plan göreli olmaktan çıkar.
7. **Karar notu disiplini sürsün:** her faz kapanışında verilen teknik kararlar (ses kütüphanesi H3, karakter fallback H10 vb.) `docs/` altına tarihli not olarak düşülsün — CLAUDE.md kuralının fazlara bağlanmış hâli.
8. **Referans cihaz Faz 0'da seçilsin:** "orta seviye Android" ifadesi elde tek bir gerçek telefona sabitlenmeli (model MEMORY.md'ye yazılır); tüm fps/yük iddiaları aynı cihazda ölçülmezse perf-log trendi (öneri #2) anlamını yitirir.
9. **Save şeması taslağı H4'te (M5 ile birlikte) çizilsin:** M5'in etiket/puan/Hidden Wish verisi save şemasının en karmaşık parçası; şemayı twist çekirdeğiyle eşzamanlı tasarlamak H6'daki M9 işini düz implementasyona indirger ve sürümleme/migration alanı baştan doğru kurulur.

## Güncelleme kuralı

Görev bitince `[x]` işaretle ve gerekiyorsa tek satır not düş (tarih + sonuç). Faz kapanışında geçiş kriterini doğrula, MEMORY.md "Aktif durum"u güncelle. Plan değişikliği (görev ekleme/kesme) önce GDD 08'e, sonra buraya işlenir.
