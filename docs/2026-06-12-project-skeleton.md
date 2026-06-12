# Karar Notu: Proje İskeleti (Vite + TS + three.js)

> Tarih: 2026-06-12 | Durum: uygulandı | Kapsam: roadmap Faz 0 "Proje iskeleti" görevi
> Üst karar: `docs/2026-06-12-engine-decision.md` §4 (stack) ve §5.1 (bu görev)

## Kurulan yapı

```
index.html          # canvas (#game-canvas) + HTML/CSS overlay (#ui-overlay) katman yapısı
vite.config.ts      # @ → src alias, es2022 target, host:true (LAN'dan cihaz testi)
tsconfig.json       # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
src/
  main.ts           # giriş: DOM ↔ scene bağlama; mantık yok (composition only)
  style.css         # mobile-first: touch-action:none, overscroll yok, safe-area inset
  core/
    events.ts       # tipli EventBus — M1–M9 ↔ scene tek köprüsü (saf TS, three import yok)
  scene/
    SceneApp.ts     # TEK three.js orkestratörü: renderer, sabit kamera, ışık, RAF döngüsü
    debugStats.ts   # ?debug ile fps/draw call/tri okuması (qa-poki ölçüm standardı)
```

## Kararlar ve gerekçeler

1. **`three@0.184.0` tam pin** (caret yok) — motor kararı §3 "API kararlılığı" telafisi. Tooling (vite/ts) caret'li; davranışı belirleyen tek bağımlılık three.
2. **Sınır kuralı koda döküldü:** three importu yalnız `src/scene/` altında; `src/core/` motor-bağımsız. `core/events.ts` üstündeki yorum kuralı belgeler — M1–M9 modülleri gelince event map oradan genişler. (Unreal köprüsü: EventBus ≈ kod-only Event Dispatcher; SceneApp ≈ elle yazılmış viewport+world, motor döngüsü yok — RAF bizde.)
3. **DPR clamp = 2:** 3x ekranlı telefonlarda fragment yükünü ~%56 azaltır; düşük-orta Android'de fps tabanını korur. WebGL2 zorunlu (M2 kir maskesi render-target'ı için) — yoksa açık hata fırlatılır.
4. **Ucuz ışık varsayılanı:** 1 directional + ambient, gölge kapalı (sistem kuralı: dinamik gölge ancak ölçümle). Low-poly Kenney setinde baked benzeri görünüm yeterli.
5. **Overlay pointer politikası:** `#ui-overlay` kökü `pointer-events:none`; etkileşimli çocuklar `.ui-interactive` ile opt-in. Böylece HUD, 3D picking'i (M4 raycast) bloklamaz.
6. **Debug ayrı ve lazy:** fps okuması `?debug` paramına bağlı; `lil-gui` devDependency olarak hazır, gerektiğinde dinamik `import()` ile yüklenecek — taban pakete girmez.
7. **`npm run build` = `tsc --noEmit && vite build`:** tip hatası build'i düşürür (Vite tek başına tip kontrolü yapmaz).

## Ölçüm (2026-06-12, ilk build)

| Çıktı | min | gzip |
| --- | --- | --- |
| JS (three tree-shaken + iskelet) | 500 KB | **126,7 KB** |
| CSS + HTML | 1,8 KB | 1,1 KB |

Bütçe: ilk paket < 5 MB gzip → motor tabanı bütçenin %2,5'i. Tam-import beklentisi 182 KB gzip idi; tree-shake ile 126,7 KB'a indi. GLTFLoader/meshopt eklenince ~10–20 KB artış beklenir.

## Açık riskler

- Sahne içeriği placeholder (küp + zemin, 2 draw call); gerçek fps/yük ölçümü Kenney odası render testiyle anlamlı (roadmap Faz 0 kalan görevler).
- Dik kadraj okunabilirliği (kamera rig'i + duvar saydamlaştırma) bu iskelette yok — ayrı spike görevi.
