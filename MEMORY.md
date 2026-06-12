# MEMORY — Oturum Hafızası (3DGameDev / Ev Ustası)

Son güncelleme: 2026-06-12 (asset pipeline + Kenney envanteri tamamlandı)
Amaç: Claude her oturum açılışında bilmesi gerekenleri buradan okur; oturum sonunda günceller. Kalıcı kurallar `CLAUDE.md`'de.

## Aktif durum

- **Faz: H1 (Faz 0) sürüyor.** Proje iskeleti kuruldu; sırada Kenney render testi, asset pipeline ve spike'lar var.
- **Vite + TS iskeleti kuruldu (2026-06-12, scene-3d-dev):** `src/main.ts` (composition) + `src/core/events.ts` (tipli EventBus, saf TS — M1–M9 köprüsü) + `src/scene/SceneApp.ts` (tek three.js orkestratörü: renderer, sabit kamera, RAF, resize, DPR clamp=2, WebGL2 zorunlu) + `src/scene/debugStats.ts` (`?debug` fps/draw call). Hibrit HTML/CSS overlay (`#ui-overlay` pointer-events:none, `.ui-interactive` opt-in). Build: **126,7 KB gzip JS** (bütçenin ~%2,5'i). Karar notu: `docs/2026-06-12-project-skeleton.md`. Henüz commit'lenmedi.
- GDD taslak v0.1 GameDesign deposundan buraya taşındı (2026-06-12): `gdd/home-makeover/` (00–08 + balance iskeleti).
- Agent sistemi kuruldu (2026-06-12): `.claude/agents/` altında 6 dev agent (scene-3d-dev, gameplay-dev, ui-dev, juice-audio-dev, asset-pipeline, qa-poki).
- **Yol haritası oluşturuldu (2026-06-12): `docs/roadmap.md`** — H1–H13 planı 6 faza ayrıldı; faz başına agent atamaları, geçiş kriterleri ve 7 öneri (git init, perf-log standardı, erken playtest havuzu vb.). Yaşayan doküman; görevler orada `[x]` işaretlenir.
- **Git deposu başlatıldı (2026-06-12):** `main` dalı, ilk commit `ed0c85f` (GDD + docs + agent sistemi, 22 dosya); `.gitignore` + `.gitattributes` (LF normalize) eklendi. roadmap.md öneri #1 kapandı; öneri #8 (referans cihaz) ve #9 (save şeması H4'te) eklendi.
- **Asset pipeline kuruldu + Kenney envanteri çıktı (2026-06-12, asset-pipeline):** 4 kit indirildi (`tools/raw-assets/`, git-ignored): Furniture Kit, Modular Buildings, Food Kit, **Blocky Characters v2.0** (18 rigli karakter, `emote-yes`/`emote-no` dahil — müşteri karakteri boşluğunu kapatabilir!). `npm run assets:build` → `tools/process-assets.mjs` (prune+weld+meshopt; KTX2 toktx kurulunca otomatik). 15 GLB işlendi → `public/assets/models/` + manifest (−%46,8). Rapor: `docs/2026-06-12-kenney-inventory.md`. scene-3d-dev notu: GLTFLoader'a MeshoptDecoder şart; `KHR_materials_unlit` ışık testinde doğrulanmalı. Tek kategori boşluğu: Wall Decor.
- **Motor kararı kesin (2026-06-12, Emre onayladı): Three.js** (`three@0.184.0` pinli; Vite + TS, gltf-transform pipeline). Karar notu: `docs/2026-06-12-engine-decision.md` (H1 görev listesi §5'te). GDD 00-overview açık sorusu kapatıldı, 08-milestones işlendi. Geri dönüş sigortası: M1–M9 motor import etmez, motor teması yalnız `scene/` katmanında.

## Sıradaki adımlar (sırayla)

1. **H1 teknik görevleri** (karar notu §5): ~~Vite + TS iskeleti~~ ✅ → Kenney GLB → gltf-transform sıkıştırma → InstancedMesh render testi, mobil fps/yük ölçümü (qa-poki). İskelet commit'i atılacak.
2. **Tasarım kapıları (paralel):** `market-analyst` doygunluk taraması + `design-critic` GDD gate'i (GameDesign deposunda koşulur, GDD'yi buradan mutlak yolla okur). Kapılar bitmeden yalnız tema-bağımsız iskelet.
3. Erken risk spike'ları: sürt-sil maskesi (render-target fırça) + **dik telefon kadrajında 3D oda okunabilirliği** (duvar saydamlaştırma, 4 açılı kamera rig'i).

## Bilinen riskler / açık kararlar

- Müşteri karakter modelleri/emote'ları Kenney kitlerinde yok (twist taşıyıcısı, en yüksek asset riski). 2D konuşma balonu fallback'i GDD'de hazır.
- Kenney kit yeterliliği (Modular Buildings + Furniture + Food) doğrulanmadı → asset-pipeline envanter çıkaracak.
- "Ev Ustası" Türkçe çalışma adı; İngilizce yayın adı araştırması yapılmadı.
- Power City (GameDesign'da aktif, 2D/Phaser) ile takvim çakışması — hangi proje önce koda girecek, Emre'nin kararı.

## Bağlantılar

- Tasarım stüdyosu: `c:\Users\emret\Desktop\GameDesign` (tasarım agent'ları, research/, reviews/, docs/ kaynak kitaplar).
- GameDesign deposunda `gdd/home-makeover.md` işaret dosyası buraya yönlendirir.

## Güncelleme kuralı

Oturum sonunda: biten işi "Aktif durum"a işle, çözülen açık kararları sil, tarihi güncelle. Kısa tut.
