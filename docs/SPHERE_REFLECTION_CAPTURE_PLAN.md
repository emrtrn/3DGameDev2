# Sphere Reflection Capture Plan

> AmaÃ§: `Add Actor -> Visual Effects` altÄ±na yerleÅŸtirilebilir **Sphere Reflection
> Capture** aktÃ¶rÃ¼ eklemek. Her probe kendi konumundan statik cubemap bake eder;
> sahnedeki PBR yÃ¼zeyler Sky Atmosphere global fallback yerine en uygun local
> probe cubemap'ini kullanabilir. Ä°lk hedef: probe baÅŸÄ±na CubeCamera bake +
> nearest-probe per-object `envMap`; ikinci hedef: local/parallax correction.

## KÄ±sa SonuÃ§

Forge'da mevcut yansÄ±ma sistemi iki parÃ§adan oluÅŸuyor:

- **Sky Atmosphere â†’ Sky Light Capture**: Sky Atmosphere'Ä±n sahip olduÄŸu global
  fallback IBL. Sky Atmosphere'Ä± PMREM'e bake edip `scene.environment` olarak
  asar; Sphere Reflection Capture etkisi olmayan PBR yÃ¼zeyler bu yansÄ±mayÄ± alÄ±r.
- **Reflection Plane**: placed actor. Three.js `Reflector` ile dÃ¼zlemsel mirror
  Ã¼retir; kendi render target'Ä± ve transform'u vardÄ±r.

Sphere Reflection Capture, bu iki sistemden farklÄ± bir Ã¼Ã§Ã¼ncÃ¼ katman olmalÄ±:

- Sky Atmosphere'Ä±n global Sky Light Capture fallback'i gibi singleton deÄŸil.
- `Reflection Plane` gibi sahneyi her frame mirror kamera ile tekrar render eden
  pahalÄ± bir sistem deÄŸil.
- YerleÅŸtirilebilir statik probe aktÃ¶rÃ¼; bake sonucu cache'lenmiÅŸ local cubemap.
- Render sÄ±rasÄ±nda nesne/placement iÃ§in en yakÄ±n/geÃ§erli probe seÃ§ilir.

## Unreal ReferansÄ±

Unreal Engine'de Reflection Capture aktÃ¶rleri statik local reflection verisi
saÄŸlar. Seviye birÃ§ok noktadan capture edilir, sphere/box gibi basit ÅŸekillere
reproject edilir ve runtime'da dÃ¼ÅŸÃ¼k maliyetle kullanÄ±lÄ±r.

Kaynaklar:

- Epic: Reflections Captures in Unreal Engine  
  https://dev.epicgames.com/documentation/unreal-engine/reflections-captures-in-unreal-engine
- Epic: Reflections Environment in Unreal Engine  
  https://dev.epicgames.com/documentation/unreal-engine/reflections-environment-in-unreal-engine
- Epic: Planar Reflections in Unreal Engine  
  https://dev.epicgames.com/documentation/unreal-engine/planar-reflections-in-unreal-engine

Unreal'dan alÄ±nmasÄ± gereken fikirler:

- Sphere/Box capture dÃ¼ÅŸÃ¼k maliyetli, statik local cubemap'tir.
- Capture aktÃ¶rleri overlap edebilir; kÃ¼Ã§Ã¼k/local capture bÃ¼yÃ¼k/global capture'Ä±
  refine eder.
- Parlak ve dÃ¼z yÃ¼zeylerde cubemap projection hatalarÄ± daha gÃ¶rÃ¼nÃ¼rdÃ¼r.
- Planar Reflection ayrÄ± bir kategoridir: daha doÄŸru fakat sahneyi tekrar render
  ettiÄŸi iÃ§in pahalÄ±dÄ±r.

## Mevcut Forge DayanaklarÄ±

Kodda ilgili sahiplik noktalarÄ±:

- `engine/scene/reflection.ts`: Sky Atmosphere-owned Sky Light Capture iÃ§in
  render-agnostik global IBL model ve defaults.
- `engine/render-three/reflection.ts`: Sky Atmosphere -> PMREM -> `scene.environment`.
- `engine/scene/reflectionPlane.ts`: Planar reflection defaults.
- `engine/render-three/reflectionPlane.ts`: `Reflector` binding.
- `engine/scene/layout.ts`: `skyAtmosphere.skyLightCapture` ve
  `reflectionPlanes?: LayoutReflectionPlane[]` ÅŸemasÄ±.
- `tools/saveValidator.ts`: reflection ve reflection plane allowlist validator'larÄ±.
- `src/editor/EditorUi.ts`: `Add Actor -> Visual Effects` butonlarÄ± ve Details
  panel binding'leri.
- `src/scene/SceneApp.ts`: editor-side build, selection, undo/redo, recapture ve
  render object lifecycle.
- `src/scene/RuntimeSceneApp.ts`: Play tarafÄ±nda instanced model/material override
  parity.

Ã–nemli mevcut kÄ±sÄ±t:

- Instanced static mesh yolu aynÄ± GLTF material referansÄ±nÄ± paylaÅŸÄ±r. Per-placement
  probe `envMap` iÃ§in materyali doÄŸrudan mutasyona uÄŸratmak tÃ¼m instance'larÄ±
  etkileyebilir. Ã‡Ã¶zÃ¼m olarak placement'larÄ± probe bucket'larÄ±na ayÄ±rmak veya
  material override clone yoluna benzer ayrÄ± render object Ã¼retmek gerekir.

## Ã–nerilen Layout Modeli

Yeni alan:

```ts
reflectionCaptures?: LayoutSphereReflectionCapture[];
```

Ã–nerilen aktÃ¶r ÅŸemasÄ±:

```ts
export interface LayoutSphereReflectionCapture {
  id: string;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  scaleLocked?: boolean;
  groupId?: string;
  nodeId?: string;
  parentId?: string;
  position: Vec3;
  radius?: number;
  intensity?: number;
  resolution?: number;
  near?: number;
  far?: number;
  parallax?: boolean;
  priority?: number;
}
```

BaÅŸlangÄ±Ã§ defaults:

- `name`: `"Sphere Reflection Capture"`
- `hidden`: `false`
- `radius`: `5`
- `intensity`: `1`
- `resolution`: `256`
- `near`: `0.1`
- `far`: `100`
- `parallax`: `false` ilk fazda false
- `priority`: `0`

## Ã–nerilen Dosya YapÄ±sÄ±

Yeni render-agnostic model:

- `engine/scene/reflectionCapture.ts`
  - `ResolvedSphereReflectionCapture`
  - `SPHERE_REFLECTION_CAPTURE_DEFAULTS`
  - `resolveSphereReflectionCapture(...)`
  - `uniqueSphereReflectionCaptureId(...)`
  - `uniqueSphereReflectionCaptureName(...)`

Yeni Three binding:

- `engine/render-three/reflectionCapture.ts`
  - `SphereReflectionCaptureRenderItem`
  - `SphereReflectionCaptureObject`
  - `createSphereReflectionCaptureObject(...)`
  - `applySphereReflectionCaptureTransform(...)`
  - `bakeSphereReflectionCapture(...)`
  - `disposeSphereReflectionCaptureObject(...)`

Editor/runtime entegrasyon:

- `engine/scene/layout.ts`: yeni layout interface ve `RoomLayout` alanÄ±.
- `tools/saveValidator.ts`: `validateSphereReflectionCapture(...)`.
- `editor/core/selection.ts`: `kind: "reflectionCapture"`.
- `editor/core/sceneObjects.ts`: outliner/details view-model.
- `editor/core/layoutSnapshots.ts`: clone helper.
- `editor/render-three/scenePicker.ts` ve `engine/render-three/picking.ts`: probe
  helper seÃ§imi.
- `src/editor/EditorUi.ts`: Add Actor button + Details panel.
- `src/scene/SceneApp.ts`: build/add/remove/set/recapture lifecycle.
- `src/scene/RuntimeSceneApp.ts`: Play parity.
- `tools/engine-tests.ts`: resolver, validator, object lifecycle, nearest-probe
  selection testleri.

## Capture Bake TasarÄ±mÄ±

Her probe iÃ§in:

1. `WebGLCubeRenderTarget(resolution)` oluÅŸtur.
2. `CubeCamera(near, far, target)` oluÅŸtur.
3. Probe helper/wire ve editor-only objeleri capture sÄ±rasÄ±nda gizle.
4. `cubeCamera.position = probe.position`.
5. `cubeCamera.update(renderer, scene)` ile cubemap Ã¼ret.
6. `PMREMGenerator.fromCubemap(cubeTarget.texture)` ile prefiltered environment
   target Ã¼ret.
7. Eski PMREM/cube target'larÄ± dispose et.
8. Probe cache'e `texture`, `position`, `radius`, `intensity`, `priority` yaz.

Capture statik olmalÄ±:

- Ä°lk load'da ve aktÃ¶r eklendiÄŸinde bake.
- Details panelde `Recapture` butonu.
- `Recapture All Reflection Captures` opsiyonel toplu komut.
- Transform/radius/resolution deÄŸiÅŸince otomatik yeniden bake opsiyonel; ilk fazda
  explicit `Recapture` daha gÃ¼venli.

## Probe SeÃ§imi

BaÅŸlangÄ±Ã§ algoritmasÄ±:

```ts
score = distance(objectCenter, probe.position) / probe.radius
```

Kurallar:

- Hidden probe yok sayÄ±lÄ±r.
- `score <= 1` ise probe etki alanÄ± iÃ§indedir.
- En dÃ¼ÅŸÃ¼k score kazanÄ±r.
- EÅŸitlikte yÃ¼ksek `priority`, sonra kÃ¼Ã§Ã¼k `radius`, sonra layout sÄ±rasÄ±.
- Probe bulunamazsa global `scene.environment` fallback olarak kalÄ±r.

Bu Unreal'Ä±n multi-probe blend modelinin basit karÅŸÄ±lÄ±ÄŸÄ±dÄ±r. Ä°lk faz iÃ§in blend
yapmadan nearest-probe seÃ§imi yeterli ve daha test edilebilir.

## Material / Instancing Stratejisi

Three.js `scene.environment` globaldir. Sphere Capture ise object/placement bazlÄ±
envMap gerektirir.

Ä°lk faz iÃ§in uygulanabilir strateji:

- Her renderable object/placement iÃ§in nearest probe hesapla.
- `MeshStandardMaterial` klonlarÄ±na `envMap = probe.pmrem.texture` ve
  `envMapIntensity = probe.intensity` ata.
- `MeshBasicMaterial` etkilenmez.
- Probe yoksa material envMap temizlenir ve global `scene.environment` devrede
  kalÄ±r.

Instanced mesh iÃ§in iki seÃ§enek:

1. **Probe bucket instancing (Ã¶nerilen)**
   AynÄ± asset placement'larÄ± `probeKey` bazÄ±nda gruplara ayrÄ±lÄ±r. Her bucket ayrÄ±
   `InstancedMesh` ve ayrÄ± cloned material set'i kullanÄ±r. Draw call artar ama
   instancing tamamen kaybolmaz.

2. **Clone fallback**  
   Material override yoluna benzer ÅŸekilde etkilenen placement'lar instanced mesh
   iÃ§inde gizlenir, ayrÄ± cloned object olarak render edilir. Basit ama Ã§ok sayÄ±da
   placement'ta pahalÄ±dÄ±r.

Ã–neri: V1'de probe bucket instancing; clone fallback sadece karmaÅŸÄ±k/Ã¶zel material
override Ã§akÄ±ÅŸmalarÄ±nda.

## Parallax Correction

`MeshStandardMaterial.envMap` tek baÅŸÄ±na local parallax vermez; cubemap'i sonsuz
uzakta varsayar. Bu yÃ¼zden "parallax" hedefi ayrÄ± faz olmalÄ±.

V1:

- Probe baÅŸÄ±na cubemap bake.
- Nearest-probe per-object envMap.
- Parallax kapalÄ±.

V2:

- `MeshStandardMaterial.onBeforeCompile` shader patch.
- Probe position/radius uniform'larÄ±.
- Reflection vector sampling'i local sphere projection ile dÃ¼zeltme.
- `customProgramCacheKey` ile shader cache ayrÄ±mÄ±.

V3:

- Multi-probe blend.
- Box Reflection Capture / box projection.
- Roughness ve probe blending kalitesi iÃ§in daha geliÅŸmiÅŸ weighting.

## UI / UX

Add Actor:

- `Visual Effects`
  - `Reflection Plane`
  - `Sphere Reflection Capture`
  - `Post Process`

Details panel:

- Name
- Location
- Radius
- Resolution: `128 / 256 / 512 / 1024`
- Intensity
- Near / Far
- Priority
- Parallax: checkbox, V1'de disabled veya "planned" notlu
- `Recapture`

Viewport:

- Wire sphere helper.
- KÃ¼Ã§Ã¼k capture icon/marker.
- SeÃ§ilebilir ve taÅŸÄ±nabilir placed actor.
- Hidden olduÄŸunda helper ve etki devre dÄ±ÅŸÄ±.

## Faz PlanÄ±

### Faz 1 - Åema ve Editor AktÃ¶rÃ¼ âœ… (tamamlandÄ±)

- [x] `LayoutSphereReflectionCapture` ekle. (`engine/scene/layout.ts` + `reflectionCaptures?` alanÄ±)
- [x] Resolver/default/id/name helper dosyasÄ±nÄ± ekle. (`engine/scene/reflectionCapture.ts`)
- [x] Validator ve layout round-trip testleri ekle. (`tools/saveValidator.ts`
  `validateSphereReflectionCapture` + `tools/engine-tests.ts`)
- [x] Selection/outliner/details modelini ekle. (`editor/core/selection.ts`,
  `sceneObjects.ts`, `editableScene.ts`, `layoutSnapshots.ts`)
- [x] Add Actor button ve Details panelini ekle. (`src/editor/EditorUi.ts`
  `renderReflectionCaptureDetails`)
- [x] SceneApp add/remove/set/undo/redo lifecycle ekle. (`src/scene/SceneApp.ts`
  add/remove/insert/set + undo commands)
- [x] Viewport wire sphere helper ve picking ekle. (`engine/render-three/reflectionCapture.ts`
  wireframe-sphere helper + `picking.ts`/`scenePicker.ts`)

Kabul:

- AktÃ¶r eklenir, seÃ§ilir, taÅŸÄ±nÄ±r, kaydedilir, yÃ¼klenir. âœ…
- `npm run build:verify` geÃ§er. âœ…

> Not: Faz 1'de capture yalnÄ±zca editor-side wireframe helper olarak gÃ¶rÃ¼nÃ¼r; bake
> ve nearest-probe envMap yok, bu yÃ¼zden `RuntimeSceneApp` parity'si Faz 3'e
> ertelendi (Play modunda capture gÃ¶rÃ¼nmez). Helper sadece pickables'a eklenir,
> surface-pickables'a deÄŸil (asset yerleÅŸtirme kÃ¼reye tutunmaz). Capture'Ä±n anlamlÄ±
> bir scale'i yoktur (boyut = `radius`), bu yÃ¼zden `applyTransform` capture iÃ§in
> `writeScale`'i atlar; `rotation` kÃ¼re iÃ§in kozmetiktir ama round-trip eder.

### Faz 2 - CubeCamera Bake Cache âœ… (tamamlandÄ±)

- [x] `engine/render-three/reflectionCapture.ts` binding ekle. (`bakeSphereReflectionCapture`,
  `SphereReflectionCaptureBake`, `disposeSphereReflectionCaptureBake`)
- [x] Probe baÅŸÄ±na cube render target + PMREM cache Ã¼ret.
  (`WebGLCubeRenderTarget` â†’ `CubeCamera.update` â†’ `PMREMGenerator.fromCubemap`;
  raw cube target bake sonunda dispose edilir, yalnÄ±zca PMREM target saklanÄ±r.)
- [x] Recapture ve Recapture All komutlarÄ± ekle. (`SceneApp.recaptureSelectedReflectionCapture`
  / `recaptureAllReflectionCaptures`; Details panelde iki buton â€” undo'ya girmez, cache tÃ¼retilmiÅŸ veridir.)
- [x] Capture sÄ±rasÄ±nda helper/editor-only gÃ¶rÃ¼nÃ¼rlÃ¼ÄŸÃ¼nÃ¼ gÃ¼venli yÃ¶net.
  (`SceneApp.withEditorAidsHidden`: gizmo + probe helper'larÄ± + planar mirror'lar +
  light icon'larÄ± bake sÃ¼resince gizlenir, sonra geri aÃ§Ä±lÄ±r.)
- [x] Dispose lifecycle testlerini ekle. (`disposeSphereReflectionCaptureBake` testi;
  bake'in kendisi canlÄ± WebGL gerektirir, `captureSkyEnvironment` gibi editor'de Ã§alÄ±ÅŸÄ±r.)

Kabul:

- Probe capture cache oluÅŸur. âœ… (load + add'de bake, `reflectionCaptureBakes[]` cache)
- Resolution deÄŸiÅŸimi eski target'larÄ± dispose eder. âœ… (`setReflectionCapture` apply'Ä±
  resolution deÄŸiÅŸiminde eski bake'i dispose edip yeniden bake eder)
- Hidden probe envMap seÃ§imine katÄ±lmaz. âœ… (hidden probe bake edilmez; hidden toggle
  bake'i dispose eder, gÃ¶rÃ¼nÃ¼r olunca yeniden bake eder)

> Not: Faz 2'de cache oluÅŸur ama henÃ¼z tÃ¼ketilmez â€” nearest-probe envMap atamasÄ± Faz 3.
> Bu yÃ¼zden Faz 2 gÃ¶rsel bir deÄŸiÅŸiklik Ã¼retmez; kabul kriterleri cache + dispose
> yaÅŸam dÃ¶ngÃ¼sÃ¼dÃ¼r. Transform/radius/intensity/near/far/priority deÄŸiÅŸiminde otomatik
> yeniden bake YOK (explicit Recapture); yalnÄ±zca resolution otomatik yeniden bake eder.

### Faz 3 - Nearest-Probe EnvMap Assignment âœ… (tamamlandÄ±)

- [x] Renderable object world center hesaplama helper'Ä± ekle. (`placementWorldCenter`
  = bounds-center Ã— placement matrix; `objectWorldCenter` = `Box3.setFromObject` â€” her iki app'te.)
- [x] Nearest-probe seÃ§im algoritmasÄ±nÄ± test et. (`selectNearestReflectionCapture`
  pure helper â€” score=dist/radius, gate scoreâ‰¤1, tie-break priorityâ†’radiusâ†’order; 2 test.)
- [x] Non-instanced/override objects iÃ§in material clone + envMap ata. (karakter + actor
  in-place `applyProbeEnvMapToObject`; override clone'lar `assignProbeEnvMapMaterial` ile.)
- [x] Instanced placements iÃ§in ~~probe bucket instancing~~ **clone-fallback** ekle
  (kullanÄ±cÄ± kararÄ±): probe-iÃ§i placement'lar InstancedMesh'ten gizlenir, mevcut
  material-override klon mekanizmasÄ±yla envMap'li ayrÄ± obje olarak render edilir;
  picking `userData.placementIndex` ile korunur.
- [x] RuntimeSceneApp parity ekle. (Play'de load sonrasÄ± bake + aynÄ± clone-fallback
  routing + char/actor envMap; statik tek seferlik, recapture yok.)

Kabul:

- Probe radius iÃ§indeki parlak/metallic (`MeshStandardMaterial`) PBR yÃ¼zeyler local
  cubemap'i kullanÄ±r. âœ… (`MeshBasicMaterial` etkilenmez.)
- Probe dÄ±ÅŸÄ±nda Sky Atmosphere global fallback'i bozulmaz. âœ… (probe yok â†’
  envMap temizlenir, `scene.environment` devrede.)
- Editor ve Play aynÄ± sonucu verir. âœ… (paylaÅŸÄ±lan `assignProbeEnvMapMaterial` +
  `applyProbeEnvMapToObject` engine helper'larÄ± + aynÄ± seÃ§im algoritmasÄ±.)

> SeÃ§ilen strateji: **clone-fallback** (probe bucket instancing yerine), Ã§Ã¼nkÃ¼
> `instanceId == placementIndex` picking sÃ¶zleÅŸmesini bozmaz ve mevcut altyapÄ±yÄ±
> kullanÄ±r. Dezavantaj: Ã§ok sayÄ±da probe-iÃ§i statik objede instancing kaybÄ±
> (Faz 5 refinement adayÄ±). Editor'de envMap atamasÄ± bake deÄŸiÅŸiminde (load/add/
> remove/recapture/hidden/resolution) tetiklenir; transform/radius/intensity/priority
> de canlÄ± (radius/intensity/priority cache scalar'Ä± gÃ¼ncellenir), near/far explicit
> Recapture bekler. Material clone'larÄ± rebuild/dispose'da serbest bÄ±rakÄ±lÄ±r.

### Faz 4 - Parallax âœ… (tamamlandÄ±)

- [x] `onBeforeCompile` shader patch prototipi. (`engine/render-three/reflectionCapture.ts`
  `installParallaxCorrection`: standard shader'Ä±n IBL `reflectVec`'ini probe kÃ¼resiyle
  kesiÅŸtirip yeniden yÃ¶nlendiren ray-sphere dÃ¼zeltmesi; vertex'te dÃ¼nya pozisyonu
  `vCaptureWorldPos` varying'i ile taÅŸÄ±nÄ±r. **Ã–nemli:** `onBeforeCompile` shader'Ä±
  `#include <...>` direktifleri AÃ‡ILMADAN alÄ±r, bu yÃ¼zden patch ham include'lara tutunur
  (`#include <worldpos_vertex>` + `#include <envmap_physical_pars_fragment>`) ve IBL chunk'Ä±nÄ±
  `ShaderChunk`'tan alÄ±p dÃ¼zeltmeyi iÃ§ine enjekte ederek inline aÃ§ar. Anchor'lar bulunamazsa
  patch sessizce atlanÄ±r â†’ plain envMap.)
- [x] Probe uniform'larÄ±: position, radius, intensity. (`captureProbePosition` +
  `captureProbeRadius` custom uniform; intensity stok `envMapIntensity` uniform'undan gelir â€”
  yÃ¶n dÃ¼zeltmesini etkilemez. TÃ¼m parallax klonlarÄ± aynÄ± programÄ± paylaÅŸsÄ±n diye
  `customProgramCacheKey` sabit bir anahtar dÃ¶ner; probe deÄŸerleri uniform olarak ayrÄ± kalÄ±r.)
- [x] `parallax` checkbox aktif et. (`src/editor/EditorUi.ts` checkbox artÄ±k aktif;
  `setSelectedReflectionCapture({ parallax })` â†’ `setReflectionCapture` toggle anÄ±nda
  cache scalar'Ä±nÄ± gÃ¼nceller ve `applyReflectionCaptureEnvMaps` ile materyalleri yeniden
  klonlayÄ±p patch'i ekler/kaldÄ±rÄ±r.)
- [x] Basit dÃ¼z yÃ¼zey ve oda test layout'u ile gÃ¶rsel doÄŸrulama. (Playwright + headed Chrome
  ile `?editor` sÃ¼rÃ¼lerek: ayna kÃ¼re/kÃ¼p + dÃ¼z yÃ¼zey sahnesinde Parallax aÃ§/kapat, viewport'a
  kÄ±rpÄ±lmÄ±ÅŸ ekran gÃ¶rÃ¼ntÃ¼leri pixelmatch ile karÅŸÄ±laÅŸtÄ±rÄ±ldÄ±. Parallax ONâ†”OFF yansÄ±tÄ±cÄ±
  yÃ¼zeylerde **2672 px (%0.55) lokalize** deÄŸiÅŸim Ã¼retti â€” dÃ¼z yÃ¼zeyde yansÄ±yan Ã§izgilerin
  tutarlÄ± kaymasÄ± + kÃ¼re yansÄ±ma silÃ¼etinde kayma; emissive/mat yÃ¼zeylerde deÄŸiÅŸim yok; shader
  derleme hatasÄ± yok; OFFâ†’ONâ†’OFF piksel-mÃ¼kemmel tersinir.)

> âš ï¸ GÃ¶rsel doÄŸrulama bir bug yakaladÄ±: ilk implementasyon `reflectVec = inverseTransformDirection(...)`
> satÄ±rÄ±na (include AÃ‡ILDIKTAN sonra var olan metin) tutunuyordu; `onBeforeCompile` shader'Ä±
> direktifler aÃ§Ä±lmadan verdiÄŸi iÃ§in anchor bulunamÄ±yor, guard erken dÃ¶nÃ¼yor ve parallax
> **sessizce no-op** oluyordu (viewport diff'i 0 px). DÃ¼zeltme: ham `#include` direktifine
> tutunup IBL chunk'Ä±nÄ± `ShaderChunk`'tan inline aÃ§mak. Birim testi de gerÃ§ek (aÃ§Ä±lmamÄ±ÅŸ)
> include davranÄ±ÅŸÄ±nÄ± yansÄ±tacak ÅŸekilde gÃ¼ncellendi.

Kabul:

- Parallax aÃ§Ä±kken local capture, object konumuna gÃ¶re daha doÄŸru yÃ¶nlenir. âœ… (kod yolu;
  shader dÃ¼zeltmesi fragment dÃ¼nya pozisyonuna gÃ¶re `reflectVec`'i probe kÃ¼resine kilitler.)
- Parallax kapalÄ±yken V3 Ã¶ncesi stabil envMap davranÄ±ÅŸÄ± korunur. âœ… (parallax kapalÄ± klon
  patch almaz, stok program cache anahtarÄ±nÄ± korur â€” birim testi doÄŸrular.)

> Not: Parallax yalnÄ±zca specular IBL reflection vektÃ¶rÃ¼nÃ¼ dÃ¼zeltir (`getIBLRadiance`);
> diffuse irradiance (`getIBLIrradiance`) kÃ¼re projeksiyonu gerektirmediÄŸinden dokunulmaz.
> DÃ¼zeltme `MeshStandardMaterial` klonlarÄ±na `bake.parallax` true olduÄŸunda
> `assignProbeEnvMapMaterial` iÃ§inde uygulanÄ±r; editÃ¶r + Play paylaÅŸÄ±lan helper'lardan
> geÃ§tiÄŸi iÃ§in parite otomatiktir. Patch `node_modules/three@0.184` shader anchor
> string'lerine baÄŸlÄ±dÄ±r; three sÃ¼rÃ¼mÃ¼ deÄŸiÅŸirse anchor kontrolÃ¼ patch'i gÃ¼venle atlar
> (plain envMap'e dÃ¼ÅŸer).

### Faz 5 - Kalite / Unreal Benzeri Refinement

- [ ] Overlap blend.
- [x] Priority/small-probe override kuralÄ±nÄ± iyileÅŸtir. (`selectNearestReflectionCapture`
  artÄ±k kapsayan probe'lar arasÄ±nda Unreal-tarzÄ± Ã¶ncelik uygular: `priority` (yÃ¼ksek) â†’
  kÃ¼Ã§Ã¼k `radius` (daha lokal capture bÃ¼yÃ¼ÄŸÃ¼ override eder, bÃ¼yÃ¼k daha merkezde olsa bile) â†’
  dÃ¼ÅŸÃ¼k `score` â†’ layout sÄ±rasÄ±. Eski "en dÃ¼ÅŸÃ¼k score kazanÄ±r" davranÄ±ÅŸÄ± yalnÄ±zca eÅŸit
  radius'larda geÃ§erli; mevcut tie-break testleri korunur + small-probe override testleri eklendi.)
- [x] Debug show flag: probe radius, selected probe, stale bake indicator. (Probe radius =
  mevcut wireframe influence-sphere helper; selected probe = mevcut selection-outline pass;
  YENÄ° **stale bake indicator**: `isReflectionCaptureBakeStale` (bake.position/near/far vs
  gÃ¼ncel item) â†’ helper kehribar (`setSphereReflectionCaptureStale`) + Details panelde uyarÄ±
  hint'i + Recapture vurgusu. `refreshReflectionCaptureObject` (transform/gizmo) ve (re)bake'te
  tazelenir; `SceneApp.isSelectedReflectionCaptureBakeStale` paneli besler. Kapsam: probe
  taÅŸÄ±ma + near/far dÃ¼zenlemesini yakalar â€” sahne iÃ§eriÄŸi deÄŸiÅŸimini (obje taÅŸÄ±ma) yakalamaz,
  o hÃ¢lÃ¢ explicit Recapture ister.)

## Riskler

- Material paylaÅŸÄ±mÄ± yanlÄ±ÅŸ yÃ¶netilirse bir probe tÃ¼m asset instance'larÄ±nÄ± etkiler.
- Ã‡ok fazla probe ve yÃ¼ksek resolution GPU memory kullanÄ±mÄ±nÄ± artÄ±rÄ±r.
- Her transform deÄŸiÅŸiminde auto-recature pahalÄ± olabilir.
- Shader patch parallax, Three.js sÃ¼rÃ¼m deÄŸiÅŸimlerine daha kÄ±rÄ±lgandÄ±r.
- Reflection Plane ile Sphere Capture aynÄ± parlak yÃ¼zeyi etkilediÄŸinde Ã¶ncelik
  net tanÄ±mlanmalÄ±: planar mirror kendi yÃ¼zeyi iÃ§in daha Ã¶zel/Ã¼stÃ¼n kabul edilmeli.

## Ã–nerilen BaÅŸlangÄ±Ã§ Dilimi

Ä°lk uygulanacak kÃ¼Ã§Ã¼k dilim:

1. Åema + validator + resolver.
2. Add Actor + outliner/details + transform/picking.
3. `build:verify`.

Bu dilim render kalitesine dokunmadan aktÃ¶r altyapÄ±sÄ±nÄ± gÃ¼venli kurar. ArdÄ±ndan
CubeCamera bake ve nearest-probe envMap ayrÄ±, test edilebilir dilimler halinde
eklenmelidir.
