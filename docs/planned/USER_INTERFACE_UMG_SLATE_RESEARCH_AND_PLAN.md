# User Interface Arastirmasi ve Forge UI Uretim Plani

> Tarih: 2026-06-23  
> Kapsam: Unreal Engine'de UMG, Slate, Widget Blueprint, Common UI, MVVM, Widget Component ve bunlarin Forge mimarisine cevrilebilir karsiliklari.  
> Hedef: Forge icin basit, veri tabanli, editor ile uretilebilen ve runtime paketinde hafif kalan bir UI uretim modeli tarif etmek.

## Kisa sonuc

Forge, Unreal'in UI araclarini birebir kopyalamamali; ayrimlarini almalidir.

- **Oyun/HUD/menu UI:** UMG benzeri, veri tabanli `.ui.json` asset'leri ve runtime HTML/CSS overlay renderer'i.
- **Editor ve arac UI:** Slate benzeri dusunulmeli, ama Forge'da mevcut TypeScript/DOM `EditorUi` cizgisinde kalmali.
- **UI state ve binding:** Tick ile surekli okuma degil, event-driven MVVM-lite store ve alan bazli bildirimler.
- **Input routing:** Common UI'dan alinacak ders; screen stack, focus, back/cancel, gamepad/klavye/fare ayrimi.
- **World-space UI:** Widget Component benzeri bir ozellik olarak sonraya birakilmali; ilk faz screen-space HUD/menu olmali.

Onerilen karar: Forge icin once **UMG Lite** insa edilmeli. Bu, gorsel UI editoru + `.ui.json` widget agaci + runtime renderer + basit event/binding sistemi anlamina gelir. Slate benzeri dusuk seviye UI framework'u veya Blueprint Graph benzeri genel gorsel script sistemi ilk faza alinmamalidir.

## Unreal Engine tarafinda kullanilan araclar

### UMG UI Designer

Unreal Motion Graphics UI Designer, oyun HUD'u, menu ve arayuz grafikleri icin kullanilan gorsel UI authoring aracidir. Temeli widget'lardir: button, checkbox, slider, progress bar, text, image gibi hazir parcalar kullanilir. Widget Blueprint icinde iki temel calisma yuzu vardir:

- **Designer:** layout, widget agaci, anchor, boyut, stil ve gorsel yerlesim.
- **Graph:** widget davranisi, event handling ve gameplay ile haberlesme.

Forge karsiligi: `UI Editor` icinde Designer/Hierarchy/Details/Preview panelleri; Graph yerine ilk fazda typed action/event listesi.

Kaynaklar:
- https://dev.epicgames.com/documentation/unreal-engine/umg-ui-designer-for-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/widget-blueprints-in-umg-for-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/displaying-your-umg-ui-in-the-viewport-in-unreal-engine

### Widget Blueprint Editor

Widget Blueprint Editor; palette, hierarchy, visual designer, details, animation ve editor mode alanlariyla UI uretim merkezidir. Content Browser'dan Widget Blueprint uretilir, Designer'da yerlesim yapilir, viewport'a eklenerek runtime'da gosterilir.

Forge karsiligi:

- Content Browser'da `New UI Widget`.
- `.ui.json` dosyasina cift tiklayinca UI Editor acilmasi.
- Palette: `Panel`, `Stack`, `Text`, `Image`, `Button`, `ProgressBar`.
- Hierarchy: widget agaci.
- Details: secili widget props, style, binding, action.
- Preview: desktop/mobile/safe-area olculeri.

### Slate UI Framework

Slate, Unreal'in dusuk seviye, deklaratif ve platformdan bagimsiz UI framework'udur. Unreal Editor'un buyuk kismi Slate ile kurulur; oyun UI icin ise Epic dokumanlari UMG'yi tercih edilen yol olarak konumlandirir.

Forge karsiligi: runtime UI icin Slate kopyasi gerekmiyor. Forge editor UI zaten TypeScript/DOM/CSS ile uretiliyor ve `?editor` modunda ayri chunk olarak yukleniyor. Bu ayrim korunmali: editor araclari dev-only kalmali, oyun UI asset'leri ise runtime paketine girmeli.

Kaynaklar:
- https://dev.epicgames.com/documentation/unreal-engine/slate-ui-framework-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/slate-overview-for-unreal-engine

### Common UI

Common UI, input routing ve platform uyumlu UI davranislari icin kullanilir. Temel fikir; viewport'un input routing tabani olmasi, UI action'larin adlandirilmis veri olarak tanimlanmasi ve controller/keyboard/mouse akislarinin ayni UI sisteminden gecmesidir.

Forge karsiligi:

- `RuntimeUiSubsystem` icinde screen stack: `push`, `replace`, `pop`.
- Her screen icin default focus ve back/cancel davranisi.
- UI etkinken gameplay input'unun kisilmasi veya yonlendirilmesi.
- UI action isimleri: `confirm`, `cancel`, `back`, `navigateUp`, `navigateDown`.

Kaynak:
- https://dev.epicgames.com/documentation/unreal-engine/common-ui-quickstart-guide-for-unreal-engine

### MVVM ve ViewModel

Unreal'in UMG Viewmodel/MVVM yaklasimi, UI'nin ihtiyac duydugu veriyi ViewModel'de tutar ve degisen alanlari widget'lara bildirir. Bu, karmasik UI'da her frame binding okumaktan daha saglikli bir modeldir.

Forge karsiligi:

- `RuntimeUiStore` veya `RuntimeViewModelStore`.
- Alan bazli subscribe/update.
- Binding ifadeleri ilk fazda sinirli ve typed olmali: `player.health`, `player.maxHealth`, `inventory.gold`.
- Liste widget'lari sonraki faza birakilmali.

Kaynak:
- https://dev.epicgames.com/documentation/unreal-engine/umg-viewmodel-for-unreal-engine

### Widget Component ve Widget Interaction

Widget Component, UMG ile uretilen UI'nin 3D dunyada veya screen-space'te gosterilmesini saglar. Widget Interaction Component ise raycast/pointer benzeri etkilesimi simule eder.

Forge karsiligi:

- Ilk fazda 3D dunyaya gomulu UI alinmamali.
- Daha sonra `WidgetComponentLite` eklenebilir:
  - world-space label/prompt,
  - actor ustunde projected DOM,
  - raycast ile button hit test,
  - gerekirse DOM-to-texture veya canvas tabanli render.

Kaynaklar:
- https://dev.epicgames.com/documentation/unreal-engine/widget-components-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/umg-widget-interaction-components-in-unreal-engine

### UMG best practices, optimizasyon ve erisilebilirlik

Unreal tarafinda one cikan dersler:

- Hedef cozum ve DPI olcekleri bastan dusunulmeli.
- Reusable User Widget'lar tercih edilmeli.
- Karmasik UI'da her frame binding yerine event-driven update kullanilmali.
- Layout degistiren sik animasyonlar pahali olabilir; transform/material benzeri hafif animasyonlar tercih edilmeli.
- UI debug/inspection araci gereklidir.
- Lokalizasyon, text formatting ve accessibility UI sisteminin sonraki ama planli parcalari olmalidir.

Forge karsiligi: CSS variable temalari, responsive anchor/safe-area kurallari, event-driven binding, debug inspector ve ileride localization/accessibility metadata.

Kaynaklar:
- https://dev.epicgames.com/documentation/unreal-engine/optimization-guidelines-for-umg-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/umg-best-practices-in-unreal-engine

## Forge mevcut durum analizi

### Guclu baslangic noktalarimiz

- `src/style.css`, canvas ustunde `#ui-overlay` katmani kuruyor. Root click-through; `.ui-interactive` ile etkilesimli widget'lar pointer event alabiliyor.
- `src/style.css`, editor stillerini runtime stillerinden ayiriyor; editor CSS'i `src/editor/editorUi.css` tarafinda dev-only chunk'a ait.
- `src/main.ts`, default route'ta `RuntimeSceneApp`, `?editor` modunda ise `SceneApp + EditorUi` yukluyor. Bu, Unreal'daki runtime/editor ayrimina uygun.
- `RuntimeSceneApp`, `inputMode: "ui"` kavramina ve UI etkinken gameplay input'unu kisma noktasina sahip.
- `public/assets/starter-content/UI/Menu.ui.json` var; ancak simdilik sadece stub.
- `tools/saveValidator.ts`, `/__content-new` icin `ui` turunu kabul ediyor ve `.ui.json` stub uretiyor.

### Bosluklar

- `.ui.json` icin gercek schema yok.
- `.ui.json` dosyasini runtime'da DOM'a render eden sistem yok.
- UI Editor yok.
- UI asset manifest'te birinci sinif asset tipi degil; mevcut `Menu.ui.json`, `assetType: "prefab"` olarak duruyor.
- Screen stack, modal/menu gecisi, back/cancel, focus ve gamepad navigation yok.
- ViewModel/binding sistemi yok.
- Reusable widget/template ve named slot sistemi yok.
- UI animation modeli yok.
- Localization/accessibility metadata yok.
- World-space UI ve UI raycast etkilesimi yok.

## Forge icin onerilen UI uretim modeli

### 1. Asset modeli

Yeni bir birinci sinif UI asset tipi hedeflenmeli:

```json
{
  "schema": 1,
  "type": "uiWidget",
  "name": "MainMenu",
  "preview": { "width": 1280, "height": 720 },
  "theme": "assets/ui/default.theme.json",
  "root": {
    "id": "root",
    "widget": "Canvas",
    "children": []
  }
}
```

Ilk widget seti:

- `Canvas`
- `Panel`
- `Stack`
- `Text`
- `Image`
- `Button`
- `ProgressBar`

Sonraki widget seti:

- `Slider`
- `Checkbox`
- `InputText`
- `ListView`
- `ScrollView`
- `Modal`

### 2. Runtime renderer

`RuntimeUiSubsystem` eklenmeli:

- `.ui.json` asset'ini okur.
- `#ui-overlay` altinda DOM agaci uretir.
- Widget id -> DOM element map tutar.
- UI screen stack'i yonetir.
- `RuntimeSceneApp.setInputMode("ui" | "game")` ile entegre olur.
- Button/action event'lerini game tarafina message veya callback olarak yollar.

Ilk aksiyon formati basit tutulmali:

```json
{
  "onClick": {
    "type": "message",
    "message": "MainMenu.StartGame"
  }
}
```

### 3. Binding ve ViewModel-lite

Binding sistemi ilk fazda genel JavaScript expression calistirmamali. Guvenli, typed ve sinirli path binding yeterli:

```json
{
  "text": { "bind": "player.healthLabel" },
  "value": { "bind": "player.health" },
  "max": { "bind": "player.maxHealth" }
}
```

Runtime tarafinda hedef:

- `setField(path, value)`
- `getField(path)`
- `subscribe(path, listener)`
- batched update
- sadece degisen widget'lari yenileme

### 4. UI Editor

Forge UI Editor, UMG Editor'dan su bolumleri almali:

- Palette
- Hierarchy
- Designer canvas
- Details panel
- Preview resolution selector
- Binding/action panel
- Save/validate

Ilk fazda alinmamasi gerekenler:

- Blueprint Graph benzeri genel node scripting.
- Full Slate benzeri custom UI framework.
- Full animation timeline.
- World-space widget editing.

### 5. Stil ve tema modeli

UI stilleri inline CSS karmasina donusmemeli. Basit tema/token modeli kullanilmali:

```json
{
  "schema": 1,
  "type": "uiTheme",
  "tokens": {
    "color.background": "#10131a",
    "color.text": "#f5f7fb",
    "radius.sm": 4,
    "space.md": 12
  }
}
```

Runtime renderer bu token'lari CSS variable olarak `#ui-overlay` altina uygular. Widget JSON'u token referansi tasir.

### 6. Paketleme ayrimi

Kritik kural:

- UI Editor ve editor CSS'i production game build'e girmemeli.
- `.ui.json`, `.theme.json` ve runtime renderer production build'e girebilir.
- `EditorUi` akisi ile runtime UI akisi birbirine import zinciriyle baglanmamali.

Bu, Forge'un mevcut `?editor` / runtime ayrimina uyumludur.

## Onerilen kararlar

1. Forge UI sistemi **UMG Lite** olarak adlandirilmali: gorsel editor + deklaratif widget asset + runtime renderer.
2. Slate benzeri dusuk seviye framework kopyalanmamali; editor UI mevcut TypeScript/DOM cizgisinde gelismeli.
3. UI Graph ilk faza alinmamali; typed event/action ve path binding yeterli.
4. `.ui.json` birinci sinif asset tipine cevrilmeli; manifest'te `assetType: "ui"` veya `assetType: "uiWidget"` olarak temsil edilmeli.
5. UI input routing, runtime input mode ile ayni kontrata baglanmali.
6. World-space UI, screen UI oturmadan baslatilmamali.

## Kontrol listesi

- [x] Unreal UI dokumantasyonundaki ana araclar incelendi: UMG, Widget Blueprint, Slate, Common UI, MVVM, Widget Component.
- [x] Forge mevcut UI tabani incelendi: `#ui-overlay`, runtime/editor split, `.ui.json` stub, input mode.
- [x] `uiWidget` asset schema'si tanimla ve `Menu.ui.json` stub'ini yeni modele tasimak icin migration plani yaz. → `engine/ui/uiWidget.ts` (savunmaci `normalizeUiWidgetDef` + `defaultUiWidgetDef`); `Menu.ui.json` gercek menuye tasindi.
- [x] Manifest/save validator tarafinda UI'yi birinci sinif asset tipi yap. → `AssetType` artik `"ui"` iceriyor, `.ui.json` inference `"ui"`ya gidiyor, `/__content-new` stub'i `defaultUiWidgetDef` uretiyor, `menu` manifest girdisi `assetType: "ui"`.
- [x] `RuntimeUiSubsystem` v1 ekle: `Canvas`, `Panel`, `Stack`, `Text`, `Button`, `ProgressBar`. → `engine/ui/uiRenderer.ts` (7 widget: + `Image`) + `src/ui/RuntimeUiSubsystem.ts` (tek-ekran mount/unmount + action dispatch).
- [x] Runtime screen stack ekle: `push`, `replace`, `pop`, `back`. → `RuntimeUiSubsystem` v2 (HUD katmani + screen stack scrim'leri, `onScreenStackChange`).
- [x] `RuntimeSceneApp` input mode entegrasyonu ile UI/game input gecisini netlestir. → `Escape` -> `menu` action toggle + pointer-lock birakilinca pause menu; screen acikken `inputMode = "ui"`, kapaninca `reengage()`.
- [x] MVVM-lite store ekle: field update, subscribe, batched render. → `engine/ui/uiViewModel.ts` (`UiViewModelStore`) + `engine/ui/uiBinding.ts` (collect/resolve/apply/bind); HUD canli bagli; UI editorde literal↔bind toggle.
- [x] UI Editor v1 ekle: palette, hierarchy, designer canvas, details, save/validate. → `src/editor/UiWidgetEditor.ts` (overlay; palette/hierarchy/canli onizleme/details) + `/__save-ui` endpoint (`validateSaveUiPayload`).
- [x] Content Browser'da `.ui.json` cift tiklama ile UI Editor ac. → `EditorUi.openUiWidgetEditor` (`assetEditorOpener` + dblclick + "UI Widget" badge).
- [x] Tema/token sistemi ekle: `.theme.json` ve CSS variable uretimi. → `engine/ui/uiTheme.ts` (`UiThemeDef`, `themeToCssVariables`, `applyUiTheme`); widget prop'larinda `$token` ref → `var(--forge-ui-*)`; runtime widget'in `theme` ref'ini yukler + koke uygular.
- [x] UI icin headless schema/render testleri ekle. → `tools/engine-tests.ts` icinde 11 check (normalizer + render-tree + style allowlist).
- [x] `npm run build:verify` ile runtime paketinde editor UI import'u olmadigini dogrula. → U3 sonrasi yesil: 330 test + `verify:dist --strict` "runtime-only" (UI artik runtime bundle'da, editor degil).
- [ ] Sonraki faz icin animation, localization, accessibility ve world-space UI gereksinimlerini ayri planla. (U7)

## Uygulama durumu

### U1 — Asset + runtime render cekirdegi (TAMAMLANDI)

Eklenenler:

- `engine/ui/uiWidget.ts`: saf veri modeli. `UiWidgetDef`/`UiNode`, 7 widget kind
  (`Canvas`, `Panel`, `Stack`, `Text`, `Image`, `Button`, `ProgressBar`), typed
  `UiAction` (`{ type: "message", message }`) ve `UiBinding` (`{ bind: path }`).
  `normalizeUiWidgetDef` savunmaci: bozuk/legacy `root: {}` stub'i bos `Canvas`
  koke yukseltir, bilinmeyen kind -> `Panel`, leaf cocuklarini atar, id'leri
  benzersizlestirir. Three/DOM bagimsiz; editor + runtime + saveValidator ortak okur.
- `engine/ui/uiRenderer.ts`: iki katman. `buildUiRenderTree` (saf, DOM'suz,
  node ortaminda test edilebilir) authored agaci `UiRenderNode` IR'ine cevirir;
  `renderUiWidget`/`mountUiRenderNode` ince DOM katmani, action listener'lari +
  id->element haritasi kurar. `resolveInlineStyle` allowlistli stil token'lari
  (px/flex-alias/passthrough) — `style` keyfi CSS olamaz.
- `src/ui/RuntimeUiSubsystem.ts`: `#ui-overlay` host'una tek widget mount/unmount,
  action'lari `onAction(message)` olarak disari verir. Ekran stack'i U3'te buyur.
- `src/style.css`: 7 widget icin runtime CSS sinifi (`.forge-ui-*`) + `--forge-ui-*`
  tema token seam'i. Sadece `Button` `.ui-interactive` (pointer-events) alir.
- Manifest: `"ui"` birinci sinif `AssetType`; `.ui.json` -> `"ui"` inference.
- `Menu.ui.json`: stub yerine calisir bir ornek menu (Canvas > Stack > Text+Button).
- 11 engine testi; `tsc --noEmit`, `npm run test:engine`, `npm run build`,
  `check:assets` hepsi yesil.

### U2/U3 — HUD/menu ornegi + input routing (TAMAMLANDI)

Eklenenler:

- `RuntimeUiSubsystem` v2: **HUD katmani** (`setHud`, click-through) + **screen stack**
  (`pushScreen`/`replaceScreen`/`popScreen`/`back`/`clearScreens`). Her ekran tam-cerceve
  bir *scrim* (`.forge-ui-screen-layer`, `pointer-events: auto`) — acik menu canvas'a
  tiklama gecisini engeller (kazara kamera yeniden-kilitlenmesi yok). `onScreenStackChange`
  derinlik degisince app'e haber verir.
- Action ayrimi: `{ type: "back" }` ekrani host icinde pop'lar (Common UI cancel);
  `{ type: "message" }` disari `onMessageAction` ile cikar.
- `RuntimeSceneApp` entegrasyonu: layout `worldSettings.hudWidget` / `pauseMenuWidget`
  asset id'lerini okur, manifest'ten `ui` asset'lerini cekip normalize eder. HUD boot'ta
  mount edilir; `Escape` (`menu` action) pause menuyu toggle eder. Ekran acilinca
  `inputMode = "ui"` + pointer-lock birakilir + cursor gosterilir; kapaninca
  `pointerLook.reengage()` (yalniz pointer-lock kamerada) yeniden kilitler. Pointer-lock
  birakilinca (Escape/alt-tab) pause menu otomatik acilir — Escape keydown'i yutan
  tarayicilarda da calisir.
- `message` widget action'lari `behaviorSubsystem.emitScriptMessage("ui-action", ...)`
  ile yayinlanir (UI -> gameplay, generic).
- UiAction `back` varyanti (engine/ui/uiWidget.ts) + renderer gecirgen.
- `PointerLookSource.release()` / `reengage()`; `Escape -> "menu"` binding.
- Demo data: `Menu.ui.json` artik pause menu (title "Paused", Resume=`back`,
  Options=`message`); yeni `Hud.ui.json` (health label + ProgressBar, statik deger —
  canli binding U5); `playground.json` worldSettings `hudWidget:"hud"` +
  `pauseMenuWidget:"menu"`.

Dogrulama: `tsc`, `npm run build:verify` (330 test + `verify:dist --strict` runtime-only),
`check:assets` PASS. Tarayicida elle dogrulanmasi gereken kisim: `/` ac, sol-ust HUD'u gor,
`Escape` ile pause menuyu ac/kapa, Resume ile oyuna don.

Acik nokta: HUD degerleri statik (ProgressBar `value: 72`). Canli `{ "bind": ... }`
cozumlemesi U5 (MVVM-lite store) isi; schema bind'leri simdiden tolere ediyor.

### U4 — UI Editor v1 (TAMAMLANDI)

Eklenenler:

- `src/editor/UiWidgetEditor.ts`: `*.ui.json` icin modal authoring shell (dev-only,
  dinamik import). Dort bolge: **Palette** (secili container'a widget ekle), **Hierarchy**
  (agac; sec/yeniden-sirala/sil), **Designer** (canli WYSIWYG — *runtime* renderer
  `renderUiWidget` ile, oyunda gorunenle birebir; tasarim cozunurlugu stage'e olceklenir),
  **Details** (secili node icin typed alanlar + Button `onClick` editoru none/back/message).
- `engine/ui/uiWidget.ts`: `createUiNode` (kind basina default prop), `findUiNode`,
  `findUiNodeParent` (saf, test edilebilir tree helper'lari).
- Save: `/__save-ui` dev endpoint + `validateSaveUiPayload` (path `.ui.json` + sunucu
  tarafi `normalizeUiWidgetDef`) — editor asla bozuk asset yazamaz. `src/editor/uiWidgetStore.ts`
  client load/save (`materialStore` deseni). `vite.config.ts` PRIVILEGED_URLS'e eklendi.
- `EditorUi.ts`: Content Browser `.ui.json` cift-tiklama -> editor; `assetEditorOpener` +
  "UI Widget" rozeti. `editorUi.css` `.uie-*` stilleri (editor chunk'inda, oyun build'inde yok).
- 3 yeni engine testi (createUiNode / find* / validateSaveUiPayload). `build:verify` 333 test
  ve `verify:dist --strict` runtime-only (editor dist'e sizmaz).

Bilinen v1 sinirlari (sonraki polish): drag-and-drop yerlestirme yok (palette ekle +
hierarchy reorder var); binding alanlari editlenmez (U5); animasyon/tema timeline yok.

### U5 — Binding / ViewModel-lite (TAMAMLANDI)

Eklenenler:

- `engine/ui/uiViewModel.ts`: `UiViewModelStore` — `setField`/`getField`/`setFields`/
  `subscribe`/`flush`/`clear`. Sadece gercekten degisen path dirty olur; `flush`
  her dinleyiciyi flush basina **bir kez** cagirir (cok-pathli bir node tek sefer
  re-render olur = batched). Saf, DOM'suz.
- `engine/ui/uiBinding.ts`: `collectUiBindings` (saf — bind tasiyan node'lar),
  `resolveUiBoundValue` (bound→store / static→literal), `applyBoundNode` (DOM:
  Text/Button→textContent, Image→backgroundImage, ProgressBar→fill width),
  `bindUiWidget` (initial apply + path abonelikleri, unmount'ta unsubscribe).
  v1 bindable prop seti: `text`, `value`, `max`, `src`.
- `RuntimeUiSubsystem`: opsiyonel `store`; HUD + her ekran mount'unda binding
  wire'lanir, unmount'ta cozulur.
- `RuntimeSceneApp`: `UiViewModelStore` olusturur, subsystem'e verir, frame basina
  possessed pawn'un `planarSpeed`'ini `player.speed` + `player.speedLabel` olarak
  besleyip `flush` eder (yalniz degisince re-render).
- `Hud.ui.json`: artik canli bagli — `Text` → `{ bind: "player.speedLabel" }`,
  `ProgressBar.value` → `{ bind: "player.speed" }` (max 6). Karakter hareket edince
  etiket + bar guncellenir.
- UI editor: bindable alanlar (text/value/max/src) icin **literal ↔ bind toggle**
  ("bind" dugmesi; aktifken alan bir field-path girer, prop `{ bind }` olur).
- 4 yeni engine testi (store notify/batched/unsubscribe + collect/resolve).
  `build:verify` 337 test + `verify:dist --strict` runtime-only.

### U6 — Tema/token sistemi (TAMAMLANDI)

Eklenenler:

- `engine/ui/uiTheme.ts`: `UiThemeDef` (`schema/type:"uiTheme"/name/tokens`),
  `normalizeUiThemeDef` (yalniz scalar token), `tokenToCssVar` (`color.surface` →
  `--forge-ui-color-surface`), `themeToCssVariables` (sayi→px, string→aynen),
  `applyUiTheme` (token'lari elemana CSS degiskeni olarak yazar; subtree miras alir).
- `uiRenderer.ts`: `resolveInlineStyle` artik `$token` ref'lerini taniyor —
  `"$color.surface"` → `var(--forge-ui-color-surface)` (prop turunden bagimsiz,
  literal px/string mantigini gecersiz kilar).
- `RuntimeUiSubsystem`: `resolveTheme(ref)` option; mount sonrasi widget'in
  `theme` ref'i cozulup koke uygulanir. `RuntimeSceneApp`: widget'larin `theme`
  ref'lerini (asset id veya path) yukler, `resolveTheme` verir.
- `EditorUi`: widget editoru artik yalniz `.ui.json`'a acilir (`isUiWidgetItem`);
  `.theme.json` (ayni `ui` asset tipi) widget olarak acilip uzerine yazilmaz.
- Demo: `Default.theme.json` (+ manifest `default-theme`); `Menu.ui.json`'a
  `theme: "default-theme"` + panel `background/padding/radius` ve baslik renkleri
  `$token`. Tema `accent` token'i built-in `--forge-ui-accent`'i de override eder
  (buton rengi temadan gelir).
- 3 yeni engine testi (normalize/themeToCssVariables/$token resolve). `build:verify`
  340 test + runtime-only.

Kapsam disi (U6b'ye not): reusable widget/template (named slot) ve debug inspector
bu fazda yapilmadi — ayri, daha buyuk parcalar.

### Sonraki adim (U6b/U7)

- U6b: reusable widget/template (named slot/`include`), UI debug inspector
  (aktif ekranlar + store alanlari), editor tema onizleme.
- U7: animation, localization, accessibility, world-space widget/component.

## Onerilen uygulama sirasi

1. **U1 - Asset ve runtime render cekirdegi:** `uiWidget` schema, validator, manifest tipi, minimal DOM renderer.
2. **U2 - HUD/menu ornegi:** mevcut `Menu.ui.json` gercek menuye cevrilir; basit health/progress HUD eklenir.
3. **U3 - Input routing:** screen stack, focus, back/cancel ve game input kisma kurali tamamlanir.
4. **U4 - UI Editor v1:** Designer/Hierarchy/Details/Palette ile JSON uretme ve kaydetme.
5. **U5 - Binding:** ViewModel-lite store ve event-driven widget update.
6. **U6 - Uretim kalitesi:** tema token'lari, reusable widget/template, debug inspector.
7. **U7 - Ileri UI:** animation, localization, accessibility, world-space widget/component.

## Kapsam disi kararlar

- Ilk fazda full Blueprint Graph yok.
- Ilk fazda Slate benzeri genel UI framework yok.
- Ilk fazda DOM-to-texture veya 3D widget raycast yok.
- Ilk fazda arbitrary JavaScript expression binding yok.

Bu sinirlar, UI sisteminin once gercek oyun menusu/HUD uretmesini ve production paketinde hafif kalmasini saglar.
