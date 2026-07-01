# Platform Temelleri — Eksik Sistemler Planı ve Checklist

> Tarih: 2026-07-01
> Durum: Aktif plan. Kod henüz yazılmadı.
> Amaç: Platform yeterlilik değerlendirmesinde tespit edilen, henüz hiçbir
> plana bağlanmamış temel eksikleri kapatmak: **CI/CD**, **Fizik/Collision
> sertleştirme**, **Seviye Akışı (Level Travel)**, **Save-Game/Persistence**,
> **Boot/Loading UX**, **Performans Altyapısı**.
> Kapsam dışı (ayrı planları var/olacak): AI sistemi
> (`docs/ongoing/AI_SYSTEM_RESEARCH_AND_PLAN.md`), VFX genişlemesi (plan
> hazırlığı kullanıcıda), networking/multiplayer, gerçek level streaming.

---

## Durum Lejantı

- `[ ]` başlanmadı
- `[~]` devam ediyor (nerede durduğu Progress Log'da)
- `[x]` bitti ve doğrulandı

Her `[x]` öncesi değişmez gate (projenin yerleşik ritmi):

```bash
npx tsc --noEmit        # temiz olmalı
npm run test:engine     # tüm check'ler (şu an 466) geçmeli
npm run build           # başarılı olmalı
# veya birleşik: npm run build:verify  (build + engine tests + strict dist scan)
```

Çalışma akışı kuralı: rutin/küçük işler için otomatik branch/commit/push yok;
iş biter, gate çalışır, kullanıcıya bildirilir. Sadece açıkça istenirse
commit/push yapılır.

Sınır kuralları (CLAUDE.md / ARCHITECTURE.md): oyun kuralları `src/game/*` +
sahne verisinde; `engine/*` editor/game import etmez; `RuntimeSceneApp` asla
`editor/*` import etmez. Yeni layout/sidecar alanları **save-validator
allowlist'ine** (`tools/saveValidator.ts`) işlenmek zorunda, yoksa kayıtta
sessizce düşer. Runtime state (save-game dahil) asla layout dosyalarına
yazılmaz — `Layout Data ≠ Save Game Data` dersi korunur.

---

## Genel Bakış ve Önerilen Sıra

| # | Faz | Bağımlılık | Neden bu sırada |
|---|-----|-----------|-----------------|
| P0 | CI/CD koruma ağı | — | Ucuz, mevcut gate'leri otomatikleştirir; sonraki tüm fazları korur. |
| P1 | Fizik/Collision sertleştirme | — | Oyun hissinin ön koşulu; saf helper'lar üstünde bağımsız ilerler. |
| P2 | Seviye Akışı (Level Travel) | — | Save-game "hangi level'dayım"a, loading UX travel'a dayanır. |
| P3 | Save-Game / Persistence | P2 | Load → level travel + spawn restore akışını kullanır. |
| P4 | Boot / Loading UX | P2 (kısmen) | İlk yükleme bağımsız; travel loading P2 API'sine bağlanır. |
| P5 | Performans Altyapısı | — | Bağımsız; diğer fazlarla paralel/aralara serpiştirilebilir. |

Önerilen akış: **P0 → P1 → P2 → P3 → P4 → P5**. P5 istenirse P1'den sonra öne
alınabilir (subsystem timing, fizik işini ölçmeyi kolaylaştırır).

---

# P0 — CI/CD Koruma Ağı

## Amaç

Elle çalıştırılan `build:verify` disiplinini otomatik bir gate'e çevirmek:
her push/PR'da tip kontrolü, engine testleri, build ve strict dist taraması
kendiliğinden çalışsın.

## Mevcut durum (kanıt)

- `.github/workflows` yok (2026-07-01 kontrol edildi); tüm gate'ler manuel.
- Gate zinciri hazır: `npm run build:verify` = `build` (içinde
  `tsc --noEmit`) + `test:engine` (466 check) + `verify:dist -- --strict`
  (`package.json:18`).
- Ek sağlık kontrolü mevcut: `npm run check:assets`
  (`tools/run-asset-manifest-health.mjs`).
- Repo'nun GitHub remote'u olup olmadığı bu planın yazımında doğrulanmadı;
  P0.1'deki karar buna bağlı.

## Kapsam kararı

- Deploy (Pages/Netlify vb.) template kapsamı dışı: her oyun fork'u kendi
  deploy hedefini seçer (`docs/planned/GAME_FORK_WORKFLOW.md` ile uyumlu).
  Bu faz yalnızca doğrulama CI'ı kurar; deploy ayrı bir fork-içi iştir.

## Checklist

- [x] **P0.1 — Remote/karar:** repo GitHub'a bağlı
  (`origin = https://github.com/emrtrn/Forge.git`, 2026-07-02 doğrulandı) →
  **A yolu (GitHub Actions)** seçildi. B yolu (pre-push hook) opsiyonel yerel
  ayna olarak backlog'da bırakıldı — istenirse eklenir.
- [x] **P0.2 — Workflow:** `.github/workflows/ci.yml` — push + PR (main),
  Node 24 (`actions/setup-node`, npm cache açık), `npm ci`,
  `npm run build:verify`, `npm run check:assets`. `concurrency` ile aynı ref'in
  uçuşta koşusu iptal edilir.
- [x] **P0.3 — Dist artifact:** başarılı build'de `dist/` 7 gün retention'lı
  artifact olarak yüklenir (`if-no-files-found: error`).
- [x] **P0.4 — Dokümantasyon:** `docs/architecture/LAUNCH_WORKFLOW.md`'ye
  "Continuous Integration" bölümü; CLAUDE.md "Working Rules"a tek satır CI notu
  eklendi.

## Kabul kriterleri

- Kasıtlı bozuk bir tip hatası push'unda CI kırmızı; düzeltince yeşil.
  *(İlk canlı koşuyla doğrulanacak — push kullanıcı onayına bağlı.)*
- CI süresi makul (< ~5 dk) — cache çalışıyor. *(İlk koşuda ölçülecek.)*

---

# P1 — Fizik/Collision Sertleştirme

## Amaç

Kinematik karakter çözümünü "düz zeminli kutu dünyası"ndan, küçük bir oyunun
gerçek level geometrisini (rampa, döndürülmüş duvar, hızlı hareket)
taşıyabilir hâle getirmek — saf/headless-test edilebilir çekirdek ritmini
bozmadan.

## Mevcut durum (kanıt)

Sanılandan ileride — G3 log'undaki "birim-küp" sınırlaması kısmen aşılmış:

- Saf planar çözüm: `src/game/collision.ts` — `resolvePlanarMovement` X/Z
  ayrı eksen (duvar kayması), dikey span gate, yalnızca-yeni-penetrasyon.
- **Zemin probe + basamak zaten var:** `findGroundAt`, `findLandingGround`,
  `filterWalkableBlockers`, `GroundProbeOptions.maxStepUp/maxStepDown`
  (`src/game/collision.ts:30-43`); default'lar `maxStepHeight 0.45`,
  `maxStepDown 0.2` (`src/game/characterMovementSystem.ts:44-45`).
- Dikey hareket: `src/game/verticalMotion.ts` — gravity/jump/floor clamp;
  floor'u caller (ground probe) sağlıyor.
- Asset-başına collision authoring tamam: primitifler, preset/kanal/yanıt
  (`docs/completed/STATIC_MESH_COLLISION_EDITOR_CHECKLIST.md`); Rapier
  backend + ragdoll mevcut (`engine/physics/physicsSubsystem.ts`).

Gerçek eksikler:

- **Eğim/rampa yok:** `src/game` altında slope/ramp izi yok (grep boş).
  AABB blocker'lar ya tam engel ya basamak; eğik yüzeyde yürüme yok.
- **Tünelleme guard'ı yok:** çözüm adım-başına; büyük `dt` spike'ı veya çok
  yüksek hızda ince duvar atlanabilir (sweep/substep yok).
- **Döndürülmüş collider davranışı doğrulanmadı:** blocker sorgusu AABB
  (`staticBlockerAabbs`); 45° döndürülmüş bir duvarın AABB şişmesinin oyun
  hissine etkisi test edilmedi.
- **Hareketli platform yok:** sorgu yalnızca *statik* blocker döndürür;
  kinematik taşıyıcı + karakteri taşıma kavramı yok.

## Kapsam kararı (karar noktası)

**Seçenek A — saf helper'ları genişlet** (öneri): mevcut headless çekirdeğe
substep + eğim desteği eklenir; test ritmi ve `engine`/`game` sınırı korunur.
**Seçenek B — Rapier KCC'ye geçiş:** Rapier'in KinematicCharacterController'ı
(shape-cast, slope limit, step offset yerleşik) kullanılır; güç kazanılır ama
headless test yüzeyi daralır, davranış Rapier sürümüne bağlanır.

Öneri: **A ile başla**; şu tetikleyicilerden biri gerçekleşirse B'ye geç:
(1) mesh-collider'lı organik geometri ihtiyacı, (2) eğim çözümünün saf AABB
dünyasında iki denemede oturmaması, (3) hareketli platform + karakter
etkileşiminin A'da kirlenmesi.

## Checklist

- [ ] **P1.1 — Tünelleme guard'ı (substep):** `resolvePlanarMovement`
  çağrısını maksimum adım uzunluğuna (ör. en ince beklenen duvar / 2) bölen
  saf bir sarmalayıcı; `characterMovementSystem` ve `input-move` bunu
  kullanır. Headless test: yüksek hız + büyük dt'de ince duvardan geçmeme.
- [ ] **P1.2 — Döndürülmüş collider doğrulaması:** playground'a 30–45°
  döndürülmüş duvar/engel ekle; AABB şişmesinin his etkisini gözlemle.
  Çıktı bir *karar kaydı*: "şişme kabul" veya "OBB desteği backlog'a".
- [ ] **P1.3 — Eğim/rampa spike + karar:** iki aday tasarım karşılaştır:
  (a) `slope` collider primitifi — AABB + yüzey fonksiyonu, ground probe'a
  eğik yüzey yüksekliği öğret; (b) Rapier shape-cast'i yalnızca *grounding*
  için kullan (planar çözüm saf kalır, zemin sorgusu Rapier'e gider).
  Spike sonucu Kalıcı Mimari Karar olarak bu dosyaya ve
  `UNREAL_BASICS_LESSONS.md`'ye işlenir.
- [ ] **P1.4 — Eğim uygulaması:** P1.3 kararına göre yürüme/kayma: slope
  limit (derece) `CharacterMovement` prop'u olur (Rotation Rate kalıbı gibi
  authored, `tools/saveValidator.ts` aktör-script şeması etkileniyorsa
  allowlist'e işlenir). Headless testler: limit altı rampada yürüme, limit
  üstünde kayma/engelleme, rampa-basamak kombinasyonu.
- [ ] **P1.5 — Test alanı içeriği:** playground'a (veya ayrı
  `CollisionGym.level.json`) merdiven, rampa, dar koridor, ince duvar,
  döndürülmüş engel bölümü. Dev sunucusunun demo layout'u otomatik
  kaydettiği bilinen davranışına dikkat (bkz. memory/CLAUDE.md) — gym'i
  default scene yapma.
- [ ] **P1.6 — (Backlog, opsiyonel) Hareketli platform:** kinematik blocker
  + üstündeki karakteri delta ile taşıma. İlk oyun gerektirmiyorsa bu
  dosyada backlog olarak kalır; gerektiğinde ayrı maddeye açılır.

## Kabul kriterleri

- Karakter: basamak çıkar/iner (regresyon), limit-altı rampada yürür,
  yüksek hızda ince duvardan geçmez, döndürülmüş engelde "görünmez duvar"
  hissi kabul edilen sınırda.
- Tüm yeni çekirdek saf ve `tools/engine-tests.ts`'te test edilmiş.

---

# P2 — Seviye Akışı (Level Travel)

## Amaç

Runtime'ın tek-layout hayatını bitirmek: oyun içinden başka bir level'a
geçiş (kapı/portal/menü), oyuncunun hedef spawn'da doğması, sahnenin temiz
sökülüp kurulması.

## Mevcut durum (kanıt)

- Runtime yalnızca `manifest.editor.defaultScene`'i yükler
  (`src/scene/RuntimeSceneApp.ts:876`); başka level'a geçiş API'si yok.
- Starter content'te birden çok level var (`Levels/Playground.level.json`,
  `Levels/TestLevel.level.json`) ama runtime'dan erişilemiyor.
- Spawn altyapısı mevcut: `src/game/gameModes/playerSpawn.ts`,
  `src/scene/playerStartIcon.ts`.
- Sensor collider + tek-temas davranış kalıbı hazır (`goal-reached`,
  `src/game/behaviors.ts`) — travel trigger'ı için doğal zemin.
- Schema-driven gameplay metadata Details panelinde düzenlenebiliyor
  (`public/assets/metadata-schema.json` hattı) — hedef level/spawn için yeni
  layout alanı gerekmeyebilir.

## Kapsam kararı

- Bu faz **travel**'dır, **streaming değil**: tek seferde bir level yüklü;
  async ön-yükleme/komşu level'ları açık tutma kapsam dışı.
- Travel *mekanizması* generic (engine/scene-runtime tarafı); travel
  *tetikleyicisi* oyun tarafı (`src/game` behavior + metadata).

## Checklist

- [ ] **P2.1 — Teardown/rebuild denetimi:** `RuntimeSceneApp`'in sahne kurulum
  yolunu incele: subsystem'ler `setEntities` ile yeniden beslenebiliyor mu,
  Three.js kaynakları (geometry/material/texture/audio) dispose ediliyor mu,
  event listener'lar sızıyor mu? Çıktı: eksik dispose listesi + düzeltmeler.
  Manuel doğrulama: iki level arasında 20+ gidiş-gelişte heap büyümesi
  stabil (Chrome memory profili).
- [ ] **P2.2 — Travel API:** `requestLevelTravel(layoutPath, spawnTag?)` —
  mevcut sahneyi söker, hedef layout'u yükler, oyuncuyu `spawnTag` eşleşen
  (yoksa default) PlayerStart'ta doğurur. Reentrancy guard'lı (travel
  sürerken ikinci istek yok sayılır/kuyruğa girer — karar). Saf çekirdek
  (state machine: idle→unloading→loading→ready) headless test edilir;
  Three/DOM tutkalı ince kalır.
- [ ] **P2.3 — Oyun tarafı trigger:** `level-travel` behavior'u — sensor
  temas + metadata'dan `targetLevel`/`targetSpawn` okur, travel API'yi
  çağırır. `goal-reached`'in temas+once kalıbını yeniden kullan.
- [ ] **P2.4 — Veri/allowlist:** hedef level/spawn metadata schema üstünden
  gidiyorsa allowlist işi yok; yeni `LayoutPlacement` alanı gerekirse
  `tools/saveValidator.ts` `applyTransformFields`'a işle (CLAUDE.md
  gotcha'sı). PlayerStart'a `spawnTag` gerekiyorsa aynı kural.
- [ ] **P2.5 — Menüden başlatma:** UMG Lite `message` action'ı ile ana
  menü ekranından "New Game → level X" akışı (`RuntimeUiSubsystem`
  `onMessageAction` köprüsü zaten var, `src/ui/RuntimeUiSubsystem.ts:38`).
- [ ] **P2.6 — Testler:** headless: travel state machine, spawn seçimi
  (tag eşleşme/fallback), trigger'ın tek-ateşleme davranışı. Manuel smoke:
  Playground ↔ TestLevel gidiş-geliş.

## Kabul kriterleri

- Oyun içi bir portal ile iki level arasında gidip gelinebiliyor; oyuncu
  doğru spawn'da doğuyor; konsol hatasız; heap stabil.
- Editor guardrail'i korunur: travel/runtime durumu layout'a yazılmaz.

---

# P3 — Save-Game / Persistence

## Amaç

Oyuncu ilerlemesini (hangi level, nerede, hangi bayraklar) ve kullanıcı
ayarlarını (ses, locale) kalıcılaştırmak; sürümlü, bozuk-veriye dayanıklı,
oyun-fork'unun genişletebileceği generic bir katman kurmak.

## Mevcut durum (kanıt)

- Save-game **hiç yok**; repo'daki tek kalıcılık Play kamera devri
  (`src/play/cameraHandoff.ts:34` — localStorage, tek anahtar).
- Mimari ders zaten kayıtlı ama uygulanmamış: `Layout Data ≠ Save Game Data`
  (`docs/architecture/UNREAL_BASICS_LESSONS.md`, Ana Sonuç bloğu).
- Lokalizasyon/locale altyapısı mevcut (`engine/ui/uiLocale.ts`,
  `Localization/en.loc.json`/`tr.loc.json`) — "seçili dil" ayarının kalıcı
  tutulacağı yer bu fazdır.

## Kapsam kararı

- Depolama ilk fazda **localStorage** (senkron, küçük JSON); IndexedDB'ye
  geçiş tetikleyicisi: kayıt boyutunun ~100KB'ı aşması veya binary ihtiyaç.
- İki ayrı kayıt türü: **SaveGame** (slot'lu oyun ilerlemesi) ve
  **UserSettings** (slot'suz; ses seviyesi, locale, erişilebilirlik).
- Generic çekirdek `engine/`e (saf, storage-adapter'lı); *ne kaydedileceği*
  oyun tarafında (`src/game/`) serializer olarak tanımlanır. Engine, oyun
  şemasını bilmez.

## Checklist

- [ ] **P3.1 — Saf çekirdek:** `engine/persistence/saveGameStore.ts` —
  slot listeleme/yazma/okuma/silme; zarf şeması `{ schema, gameId,
  createdAt, updatedAt, payload }`; sürüm + `migrate(from, data)` hook'u;
  bozuk/eksik JSON'da sessiz `null` + telemetri log'u (crash yok). Storage
  adapter arayüzü (in-memory test adapter'ı + localStorage adapter'ı).
  Headless testler: round-trip, migration zinciri, bozuk veri, quota hatası
  (`setItem` throw) yutma.
- [ ] **P3.2 — Oyun serializer sözleşmesi:** `src/game/saveGame.ts` —
  `collectSaveState()` / `applySaveState()`; ilk kapsam: aktif level path,
  oyuncu transform + facing, gameplay bayrakları (BehaviorContext `state`
  üzerinden kayıt-değer çiftleri — hangi bayrakların kalıcı olduğu davranış
  başına opt-in). Karar noktası: dikey hız/havada-olma kaydedilmez (spawn
  grounded başlar — basitlik).
- [ ] **P3.3 — Load → travel entegrasyonu:** kayıt yükleme P2
  `requestLevelTravel` üstünden akar: level'ı yükle, spawn yerine kayıtlı
  transform'u uygula, bayrakları geri bas. Headless test: state
  restore'un travel state machine'iyle sıralaması.
- [ ] **P3.4 — UserSettings:** ayrı anahtar; ses bus seviyeleri
  (`engine/audio/audioBus.ts` hattı) + locale. Boot'ta uygula; ayar
  ekranından değişince yaz.
- [ ] **P3.5 — UI:** UMG Lite save/load menü widget'ı (starter content'e
  `.ui.json`): slot listesi (ViewModel bind), Save/Load/Delete `message`
  action'ları; oyun tarafı `onMessageAction`'da bağlar.
- [ ] **P3.6 — Checkpoint davranışı:** `checkpoint` behavior'u — sensor
  temasında otomatik kayıt (temas+once kalıbı); parametre: slot adı/auto.
- [ ] **P3.7 — Doğrulama içeriği:** playground'a checkpoint + toplanabilir
  bayrak örneği; kaydet → sayfayı yenile → yükle → aynı yer/bayrak smoke'u.

## Kabul kriterleri

- Yenile-sonrası tam geri dönüş: level + konum + bayraklar + ayarlar.
- Bozuk localStorage verisi oyunu düşürmez (temiz "yeni oyun" düşüşü).
- Engine katmanında oyun şeması sızıntısı yok; sınır kuralları korunur.

---

# P4 — Boot / Loading UX

## Amaç

Soğuk açılışta ve level travel sırasında siyah ekran yerine ilerleme gösteren,
hata durumunu yakalayan bir yükleme deneyimi.

## Mevcut durum (kanıt)

- Yükleme ilerlemesi/ekranı yok: `RuntimeSceneApp`'te `LoadingManager` /
  `onProgress` izi yok (grep, 2026-07-01).
- Web Audio unlock **zaten çözülmüş**: `resumeContext()`
  (`engine/audio/audioSubsystem.ts:272`) ilk `pointerdown`'a bağlı
  (`src/scene/RuntimeSceneApp.ts:1600`) — bu faz onu yeniden yapmaz.
- UMG Lite screen stack + scrim mevcut (`src/ui/RuntimeUiSubsystem.ts`) —
  loading ekranı için hazır taşıyıcı.

## Checklist

- [ ] **P4.1 — İlerleme sayacı (saf):** manifest'ten türetilen ön-yükleme
  listesi (GLB'ler, texture'lar, ses dosyaları, locale/ui json'ları) +
  `{loaded, total, failed}` sayan saf bir progress aggregator; loader
  hattına (GLTF/texture/audio yükleyicileri) tamamlanma callback'leri
  bağlanır. Headless test: sayaç, hata toplama, boş liste.
- [ ] **P4.2 — Loading ekranı:** starter content'e `UI_Loading.ui.json`;
  boot'ta screen stack'e push, progress bind (ViewModel), asset'ler hazır +
  ilk frame render olunca pop. `?debug`'da asset sayısı/süre dökümü.
- [ ] **P4.3 — Hata durumu:** kritik asset başarısızlığında retry butonlu
  hata ekranı (message action); kritik-olmayan (ör. tek ses dosyası)
  eksikte konsol uyarısı + devam. "Kritik" tanımı: layout'un referansladığı
  model asset'leri — karar netleşince buraya işlenir.
- [ ] **P4.4 — Travel loading:** P2 travel state machine'inin
  `loading` durumu aynı loading ekranını gösterir; kısa geçişlerde
  flicker'ı önlemek için minimum gösterim süresi (ör. 300ms) veya eşikli
  gecikme — karar.
- [ ] **P4.5 — "Başlamak için tıkla" (karar):** pointer-lock/fullscreen
  isteyen oyun modları için loading→başlangıç arasına opsiyonel etkileşim
  kapısı. Template default'u: kapı yok (mevcut pointerdown unlock yeterli);
  fork'lar açabilir.

## Kabul kriterleri

- Soğuk yüklemede progress görünür; yükleme bitmeden oyun input'u akmaz.
- Travel sırasında loading durumu görünür, geçiş sonrası temiz kapanır.
- Editor moduna sızıntı yok (loading UI yalnız runtime shell'de).

---

# P5 — Performans Altyapısı

## Amaç

"Yavaşladı ama neden?" sorusuna repo içinden cevap verebilmek: subsystem
zamanlamaları, bellek sayaçları, bütçe eşikleri ve offline asset raporu.

## Mevcut durum (kanıt)

- `?debug` overlay'i fps + draw call + üçgen + GameMode/UI/script-message
  anlık görüntüsü veriyor (`src/scene/debugStats.ts:20-28`); subsystem tick
  süreleri, bellek sayaçları ve eşik uyarısı yok.
- Offline asset hattı var: `npm run check:assets`
  (`tools/run-asset-manifest-health.mjs`), gltf-transform/meshoptimizer
  devDependency; runtime LOD yok.

## Kapsam kararı

- **Runtime LOD bu fazda kapsam dışı** (karar): offline optimizasyon +
  bütçe raporu önce gelir; LOD tetikleyicisi = tek sahnede üçgen bütçesinin
  içerikle aşılması ve draw-call/üçgen kaynaklı ölçülmüş fps düşüşü.
- Ölçüm kodu `?debug`/dev yolunda kalır; production frame döngüsüne sabit
  maliyet eklenmez.

## Checklist

- [ ] **P5.1 — Subsystem tick timing:** engine update döngüsünde
  (`engine/core/EngineApp.ts` hattı) debug-etkinken subsystem başına ms
  ölçümü; overlay'e "en pahalı 3 subsystem" satırı. Saf toplama/istatistik
  (rolling ortalama) headless test edilir.
- [ ] **P5.2 — Bellek sayaçları:** `renderer.info` (geometries, textures,
  programs) + varsa `performance.memory` (Chrome-only, guard'lı) overlay'e.
- [ ] **P5.3 — Bütçe eşikleri:** basit sabitler (ör. draw call, üçgen,
  texture sayısı) — aşımda overlay satırı vurgulanır. Bütçelerin nerede
  yaşayacağı karar noktası: kod sabiti (basit, öneri) vs
  `project.3dgame.json` editor alanı (fork-başına ayar; manifest şeması +
  doküman notu gerektirir).
- [ ] **P5.4 — Offline asset raporu:** `tools/`'a perf raporu (yeni script
  veya `check:assets` genişletmesi): GLB başına üçgen/vertex sayısı, texture
  boyutları/çözünürlükleri, en büyük 10 asset; eşik aşımı uyarısı. CI'a
  (P0) bilgi-amaçlı adım olarak eklenebilir (fail etmez).
- [ ] **P5.5 — Doküman:** `?debug` overlay'inin okunuşu + bütçe felsefesi
  kısa notu (`docs/architecture/LAUNCH_WORKFLOW.md` veya bu dosyanın
  sonuna).

## Kabul kriterleri

- `?debug` ile bir sahnenin darboğazı (hangi subsystem / render mi)
  overlay'den okunabiliyor.
- Asset raporu tek komutla çalışıyor; en büyük maliyetleri listeliyor.
- Production bundle'a ölçüm maliyeti sızmıyor (`build:verify` strict scan).

---

## Backlog (bu plana bilinçli alınmayanlar)

- Hareketli platform (P1.6 — ilk oyun gerektirirse açılır).
- OBB/rotated collider tam desteği (P1.2 kararına bağlı).
- IndexedDB storage adapter'ı (P3 tetikleyicisi: kayıt boyutu).
- Runtime LOD + level streaming (P5 kararı: içerik ölçeği gerektirene dek).
- Cloud save / çoklu profil, networking, replay.

## Progress Log

- *2026-07-01* — Plan oluşturuldu (platform yeterlilik değerlendirmesinin
  çıktısı). Henüz hiçbir faza başlanmadı. Değerlendirme sırasında düzeltilen
  önemli tespit: zemin probe + basamak çık/in collision katmanında zaten
  mevcut (`findGroundAt`/`maxStepUp`/`maxStepDown`); P1 bu yüzden eğim,
  tünelleme, döndürülmüş collider ve platforma odaklanır. Audio unlock da
  mevcut; P4 yükleme ekranına daraltıldı.
- *2026-07-02* — **P0 tamamlandı (kod tarafı).** Remote doğrulandı
  (`github.com/emrtrn/Forge.git`) → GitHub Actions (A yolu).
  `.github/workflows/ci.yml` eklendi: push/PR→main, Node 24 + npm cache,
  `npm ci` → `build:verify` (466 engine check + `verify:dist --strict` PASS) →
  `check:assets`, başarıda `dist/` 7 gün artifact; `concurrency` ile ref
  iptali. Dokümantasyon (LAUNCH_WORKFLOW "Continuous Integration" + CLAUDE.md
  Working Rules) eklendi. Yerel gate yeşil (`npm run build:verify`). **Açık
  kalan:** canlı CI koşusu (kırmızı-on-break / yeşil-on-fix, süre < ~5 dk)
  henüz gözlenmedi — ilk push kullanıcı onayı gerektiriyor (working-style
  kuralı: otomatik push yok). B yolu (pre-push hook) opsiyonel backlog.
  **Sıradaki:** P1 — Fizik/Collision sertleştirme.
