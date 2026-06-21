# Exponential Height Fog Checklist

> Tarih: 2026-06-20
> Amaç: Unreal'daki **Exponential Height Fog** aktörüne karşılık gelen bir
> atmosfer sis sistemini Forge'a eklemek. Fog, Sky Atmosphere ile aynı kalıpta
> bir **layout singleton "environment actor"** olarak yaşar: transform'suz,
> sahnede tek, `category: "visual-effects"`, undo/redo'lu, kendi Details paneli
> olan ve `Add Actor → Visual Effects` menüsünden tıkla-ekle ile gelen bir aktör.
>
> Bu doküman önce Unreal modelini özetler, Forge'un mevcut durumuyla eşler,
> kapsam/mimari kararı verir, ardından **Faz 1 (yerleşik scene fog, MVP)** ve
> **Faz 2 (gerçek height-falloff shader)** için fazlı checklist sunar.
> **Faz 3 (directional inscattering / volumetric) kapsam dışıdır.**

## Kaynaklar (incelenen Unreal dokümantasyonu)

- [Exponential Height Fog in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/exponential-height-fog-in-unreal-engine)

## Şablon (taklit edilen mevcut Forge deseni)

Sky Atmosphere, fog'un birebir izleyeceği "layout singleton environment actor"
şablonudur. Fog her katmanda onun ikizi olarak kurulur:

| Katman | Sky Atmosphere referansı |
| --- | --- |
| Render-agnostik model | `engine/scene/skyAtmosphere.ts` (`ResolvedSkyAtmosphere`, defaults, `resolveSkyAtmosphere`) |
| Render bağlama | `engine/render-three/skyAtmosphere.ts` |
| Layout tipi | `engine/scene/layout.ts:252` `LayoutSkyAtmosphere`, `:312` `RoomLayout.skyAtmosphere?` |
| Save validator | `tools/saveValidator.ts:526` `validateSkyAtmosphere` (+ `vite.config.ts` allowlist) |
| Seçim tipi | `editor/core/selection.ts:6` `kind: "sky"` |
| Outliner/Details VM | `editor/core/sceneObjects.ts:23` `buildSkyEditableSelection` |
| SceneApp orkestrasyon | `src/scene/SceneApp.ts:2571` `applySkyAtmosphere` + `add/set/removeSkyAtmosphere` + `commitSky` |
| Editör Details paneli | `src/editor/EditorUi.ts:3061` `renderSkyDetails` |
| Add Actor menüsü | `src/editor/EditorUi.ts:306` "Visual Effects" başlığı |

---

## Bölüm A — Unreal Exponential Height Fog Modeli (özet)

Height Fog, **yüksekliğe bağlı**, kameradan uzaklaştıkça biriken bir atmosfer
sisidir: alçak kotlarda yoğun, yükseldikçe seyrek. Başlıca alanlar:

### A.1 Yoğunluk & yükseklik

- **Fog Density**: genel yoğunluk (sis katmanının kalınlığı).
- **Fog Height Falloff**: yükseklikle yoğunluğun azalma hızı; küçük değer = daha
  geniş, yumuşak geçiş.
- **Start Distance**: sisin kameradan kaç birim sonra başladığı.
- **Fog Cutoff Distance**: sisin tamamen kesildiği mesafe (ör. ön-sislenmiş
  gökyüzünü/atmosferi dışlamak için).
- **Fog Height Offset** (ikincil katmanda): aktörün Z'sine göre dikey konum.

### A.2 Görsel

- **Fog Inscattering Color**: sisin ana rengi.
- **Fog Max Opacity**: en yüksek opaklık (0–1); 1 = tam opak, 0 = görünmez.
- **Sky Atmosphere Ambient Contribution Color Scale**: yönsüz sise Sky Atmosphere
  katkısının ölçeği.

### A.3 İkincil sis katmanı (Second Fog Data)

Bağımsız ikinci bir katman: Secondary Fog Density / Height Falloff / Height
Offset.

### A.4 Directional Inscattering (Faz 3 — KAPSAM DIŞI)

Güneş yönünde parlayan sis hüzmesi (Color / Exponent / Start Distance).

### A.5 Volumetric Fog (Faz 3 — KAPSAM DIŞI)

Frustum içinde her noktada fiziksel hesaplanan hacimsel sis (Scattering
Distribution, Albedo, Emissive, Extinction Scale, View Distance...). Forge'da
maliyet/fayda düşük; **bu çalışmada yapılmayacak.**

---

## Bölüm B — Forge Mevcut Durum

- **Sahnede hiç fog yok.** `Grep` ile `fog`/`Fog`/`FogExp2` yalnızca dokümanda
  geçiyor; render hattında kullanım yok → temiz başlangıç.
- **Three.js fog yetenekleri:** `FogExp2` (üssel, mesafeyle) ve `Fog` (lineer,
  near/far). **İkisi de mesafe-tabanlıdır, yükseklik-tabanlı değildir** — dünya
  Y eksenine bakmaz, kameraya uzaklığa bakar.
- **Gerçek height-falloff** (UE'nin asıl hissi) ancak özel shader
  (`onBeforeCompile` ile fog fragment chunk override) ya da post-process pass ile
  elde edilir → **Faz 2**.
- **Ölçek uyarısı:** Kamera far-plane'i sadece **100 birim**
  (`engine/render-three/skyAtmosphere.ts:36`). UE santimetre + dev mesafelerle
  çalışır; bizim `density`/`start`/`end` değerlerimiz bu küçük ölçeğe göre
  ayarlanmalı (ör. `FogExp2.density` ~0.01–0.1).
- **Sky Atmosphere singleton altyapısı hazır**: tıkla-ekle, undo/redo, save
  round-trip, transform'suz Outliner/Details — fog aynısını yeniden kullanır.
- **Save validator gotcha:** allowlist'e (`tools/saveValidator.ts`, `vite.config.ts`
  import eder) eklenmeyen her yeni layout alanı kayıtta **sessizce düşer**.

---

## Bölüm C — Eşleme & Kapsam Kararı

| Unreal alanı | Forge karşılığı | Faz |
| --- | --- | --- |
| Fog Inscattering Color | `color` (hex) → `scene.fog.color` | **Faz 1** |
| Fog Density | `density` → `FogExp2.density` (ölçeğe uygun) | **Faz 1** |
| (sis modu) | `mode: "exp" \| "linear"` (FogExp2 / lineer Fog) | **Faz 1** |
| Start/End (lineer) | `start` / `end` → `Fog.near` / `Fog.far` (lineer modda) | **Faz 1** |
| hidden / enabled | `hidden?` (Sky gibi) | **Faz 1** |
| Fog Height Falloff | dünya-Y tabanlı üssel yoğunluk (custom shader) | **Faz 2** |
| Fog Height (taban kotu) | `heightBase` (fog yoğunluğunun referans Y'si) | **Faz 2** |
| Start Distance | `startDistance` (shader'da near kesim) | **Faz 2** |
| Fog Max Opacity | `maxOpacity` (0–1, shader'da clamp) | **Faz 2** |
| Fog Cutoff Distance | `cutoffDistance` (uzakta sisi kes) | **Faz 2** |
| Second Fog Data | ikinci katman | **Ertele (Faz 2 sonu, opsiyonel)** |
| Directional Inscattering | güneş yönünde hüzme | **KAPSAM DIŞI (Faz 3)** |
| Volumetric Fog | hacimsel sis | **KAPSAM DIŞI (Faz 3)** |

---

## Bölüm D — Mimari Kararlar

- **Veri sahipliği:** Fog, **layout singleton actor**'dür. `RoomLayout.heightFog?`
  alanında yaşar (Sky'ın `skyAtmosphere?` ile birebir). World Settings'e
  konmaz — Sky ile tutarlılık için layout aktörü.
- **Tek seçim/komut yolu:** `Selection`'a `kind: "fog"` eklenir; ekleme/silme/
  düzenleme `commitFog` ile tek undoable komut (Sky'ın `commitSky` ikizi).
- **Render bağlama sahne seviyesinde:** Faz 1'de `scene.fog` set/clear edilir;
  hiçbir mesh materyali elle değiştirilmez (Three.js fog'u otomatik uygular).
  Faz 2'de fog chunk override veya post-pass eklenir.
- **Editor core generic kalır:** fog engine-generic'tir; proje-özel kural yok.
- **Bundle ayrımı:** Details paneli + menü `src/editor/` altında, `?editor`
  dinamik importunun arkasında; game build'e girmez. Render bağlama (`scene.fog`)
  hem editör hem runtime'da çalışır (`SceneApp` + `RuntimeSceneApp`).
- **Save validator gotcha:** `validateHeightFog` eklenir; her alan allowlist'te
  açıkça kopyalanır, aralık dışı değer düşer (Sky'ın `validateSkyAtmosphere`
  deseni).

---

## Checklist

Durum: `[ ]` yapılmadı · `[~]` kısmi · `[x]` tamam

### Faz 0 — Araştırma & Karar (bu doküman)

- [x] Unreal Exponential Height Fog dokümanını incele ve özetle (Bölüm A)
- [x] Forge mevcut durumu + Three.js fog sınırlarını çıkar (Bölüm B)
- [x] Kapsam/eşleme (Bölüm C) ve mimari karar (Bölüm D)
- [x] Karar: fog = layout singleton actor; Faz 1 yapılacak, Faz 2 gerekirse,
      Faz 3 kapsam dışı

---

### Faz 1 — Yerleşik Scene Fog (MVP, mesafe-tabanlı)

**Hedef:** `Add Actor → Visual Effects → Exponential Height Fog` ile eklenen,
`FogExp2` (üssel) + lineer mod destekli, undo/save/Details'lı tam singleton
aktör. Mesafe-tabanlı; height-falloff yok (o Faz 2).

#### F1.1 — Model (render-agnostik)

- [x] `engine/scene/heightFog.ts`: `ResolvedHeightFog` arayüzü
      (`name`, `hidden`, `mode`, `color`, `density`, `start`, `end`)
- [x] `HEIGHT_FOG_DEFAULTS` (`mode:"exp"`, `density:0.03`, `color:"#bcc6d1"`,
      `start:5`, `end:60`)
- [x] `resolveHeightFog(actor)` — Sky'ın `resolveSkyAtmosphere` ikizi

#### F1.2 — Render bağlama

- [x] `engine/render-three/heightFog.ts`: `applySceneFog(scene, resolved | null)`
      → exp modda `FogExp2(color, density)`, lineer modda `Fog(color, start, end)`,
      `hidden`/null'da `scene.fog = null`
- [x] Model + defaults re-export (Sky'ın render modülündeki re-export deseni)

#### F1.3 — Layout tipi & persistans

- [x] `engine/scene/layout.ts`: `LayoutHeightFog` arayüzü + `RoomLayout.heightFog?`
- [x] `tools/saveValidator.ts`: `validateHeightFog` (allowlist, aralık reddi,
      placed-fog her zaman round-trip — `validateSkyAtmosphere` deseni)
- [x] `validateLayout`'a `heightFog` bağlı + `vite.config.ts` `validateLayout`'u
      import ediyor (allowlist saveValidator içinde)
- [x] CLAUDE.md "save-validator allowlist gotcha" notuna fog alanları eklendi

#### F1.4 — Seçim & Outliner/Details VM

- [x] `editor/core/selection.ts`: `kind: "fog"` (clone / encodeSelectionId /
      parseSelectionId / selectionsEqual + `FogSelection` tipi)
- [x] `editor/core/sceneObjects.ts`: `HEIGHT_FOG_ASSET_ID`,
      `buildFogEditableSelection` (`category: "visual-effects"`, transform'suz),
      liste + tek-seçim çözümü
- [x] `EditableSelection`'a `fog?: EditableFog` alanı (+ `EditableFog` tipi)

#### F1.5 — SceneApp orkestrasyon (editör + ortak)

- [x] `applyHeightFog()` — `layout.heightFog` → `applySceneFog` (`applySkyAtmosphere`
      yanında çağrılıyor)
- [x] `addHeightFog()` / `removeHeightFog()` / `setHeightFog(patch, label)`
- [x] `commitFog(next, label)` — tek undoable mutasyon (`commitSky` ikizi)
- [x] `rename`/`setHidden`/`deleteSelected` + tüm singleton dalları (picker,
      gizmo, outline, mutableTransform, visibility) `kind: "fog"` ile genişletildi
- [x] `getSelectionLabel` + `hasSelection` fog dalı

#### F1.6 — Runtime bağlama

- [x] `RuntimeSceneApp.applyRuntimeFog()` yükleme yolunda `applySceneFog` çağırıyor
      (`applyRuntimeSky` yanında) — Play modunda da fog görünür

#### F1.7 — Editör UI

- [x] "Visual Effects" başlığı altına
      `<button data-add-height-fog>Exponential Height Fog</button>`
- [x] Tıkla-ekle bağlaması (`addHeightFog()`), Sky handler'ı ikizi — drag yok
- [x] `renderFogDetails(selection)`: name, mode (exp/linear), color, density (exp),
      start/end (linear) alanları + `setHeightFog` bağlamaları (mod değişince
      alanlar canlı takas)
- [x] `renderDetails` içinde `selection.kind === "fog"` dalı
- [x] Outliner harfi `kind === "fog"` → "F"

#### F1.8 — Test & doğrulama

- [x] `tools/engine-tests.ts`: `resolveHeightFog` defaults + `applySceneFog`
      exp/linear/null lifecycle testi
- [x] Save round-trip testi (`validateHeightFog` + `validateLayout` ile fog
      alanları düşmüyor)
- [x] `npx tsc --noEmit` temiz; `node tools/run-engine-tests.mjs` 197/197 yeşil
- [ ] Manuel akış doğrulaması (tarayıcıda): Add Actor → Exponential Height Fog →
      Details'tan renk/yoğunluk → Play'de görünüyor → Save/Reload → Undo/Redo →
      Delete. *(Kod yolu tsc + unit testlerle doğrulandı; tarayıcı dev sunucusu
      playground.json'u autosave ile yeniden yazdığından elle test kullanıcıya
      bırakıldı.)*
- [ ] `docs/UNREAL_BASICS_LESSONS.md` Progress Log'a giriş *(opsiyonel; bu
      checklist zaten track kaydı)*

---

### Faz 2 — Gerçek Height Falloff (custom shader) — *gerekirse*

**Hedef:** UE'nin asıl "height fog" hissi: dünya-Y'ye göre üssel yoğunluk +
start distance + max opacity + cutoff. Faz 1 yeşil geçtikten sonra; istenmezse
**iptal edilebilir.**

- [ ] Yaklaşım kararı: (a) `material.onBeforeCompile` ile `fog_fragment` chunk
      override (tüm lit materyaller), **veya** (b) ayrı full-screen post-process
      fog pass (depth + reconstructed world pos). Tercih: başlangıçta (a).
- [ ] `ResolvedHeightFog`'a alanlar: `heightFalloff`, `heightBase`,
      `startDistance`, `maxOpacity`, `cutoffDistance` + defaults + validator
      allowlist + Details alanları
- [ ] Shader: world-space Y'den üssel yoğunluk integralı (height falloff),
      view-distance ile birleşik; `startDistance` ve `cutoffDistance` kesimleri;
      sonucu `maxOpacity` ile clamp
- [ ] Fog rengini Sky Atmosphere ambient/gökyüzü ile harmanlama (opsiyonel,
      `skyAtmosphere` varsa) — yalnızca renk, directional inscattering DEĞİL
- [ ] Materyal kayıt/temizlik: fog aktörü kalkınca chunk override geri alınır
      (mesh ekle/çıkar ve materyal paylaşımıyla doğru çalışır)
- [ ] (opsiyonel) İkinci sis katmanı (Second Fog Data): `secondary*` alanları
- [ ] Editör/runtime ölçek doğrulaması (100u far-plane'de makul görünüm)
- [ ] `tools/engine-tests.ts`: height-falloff yoğunluk fonksiyonu birim testi
- [ ] `npx tsc --noEmit` temiz + akış doğrulaması

---

## Kararlar (2026-06-20 netleşti)

1. **Veri sahipliği:** Fog, **layout singleton actor** (`RoomLayout.heightFog?`),
   World Settings değil — Sky Atmosphere ile tutarlı.
2. **Kapsam:** Önce **Faz 1** (yerleşik FogExp2 + lineer, mesafe-tabanlı).
   **Faz 2** (gerçek height-falloff shader) gerekirse sonra yapılır ya da iptal
   edilir. **Faz 3** (directional inscattering, volumetric) **kapsam dışı.**
3. **Menü:** `Add Actor → Visual Effects` başlığı altında, Sky Atmosphere'in
   hemen yanında **"Exponential Height Fog"**; Sky gibi tıkla-ekle (drag yok).
4. **Ölçek:** Density/start/end değerleri 100u far-plane ölçeğine göre ayarlanır.
