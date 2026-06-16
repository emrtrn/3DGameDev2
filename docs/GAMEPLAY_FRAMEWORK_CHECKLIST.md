# Gameplay Framework Checklist

> Tarih: 2026-06-16
> Amaç: Forge Play akışını değiştirmeden, Unreal'daki GameMode / Pawn /
> PlayerController / PlayerState ayrımına karşılık gelen açık bir gameplay
> framework katmanı kurmak.

## Kararlar

- Play düğmesi tek akış olarak kalır: editor layout'u kaydeder, `/` runtime route açılır.
- `Preview / Simulate / Game` ayrımı yapılmayacak.
- Varsayılan Game Mode, sahnede karakter arayıp TPS başlatmayacak.
- Varsayılan Game Mode, WASD ile hareket eden runtime-only bir camera pawn kullanacak.
- TPS mevcut çalışma boşa gitmeyecek; ayrı seçilebilir Game Mode template'i olacak.
- Game Mode seçimi World Settings altında yaşar.
- Runtime state layout'a otomatik yazılmaz.
- Game Mode davranışı editor core'a gömülmez; runtime/game code yorumlar.

## Hedef Kavram Eşlemesi

| Unreal | Forge hedefi |
| --- | --- |
| GameMode | `GameModeDefinition` / `GameModeRegistry` |
| Default Pawn Class | `defaultPawn` |
| PlayerController Class | `playerController` |
| Pawn / Character | runtime-controlled entity or camera pawn |
| PlayerStart | layout actor or session spawn marker |
| PlayerState | runtime-only player state |
| GameState | runtime-only game/session state |
| Possess | controller'ın pawn'a bağlanması |
| World Settings | `worldSettings.gameMode` |

## Checklist

### 1. Sözleşme ve Veri Modeli

- [x] `GameModeDefinition` tipini ekle. (`src/game/gameModes/types.ts`)
  - `id`
  - `displayName`
  - `defaultPawn`
  - `playerController`
  - optional `description`
- [x] `PawnDefinition` tipini ekle.
  - `id`
  - `kind: "camera" | "character"`
  - optional movement/camera config
- [x] `PlayerControllerDefinition` tipini ekle.
  - `id`
  - input action mapping contract (`inputActions`)
  - possess target contract (`possess`)
- [x] Runtime-only `PlayerState` ve `GameState` veri yüzeylerini tanımla.
- [x] `worldSettings.gameMode?: string` alanını resmi schema parçası yap. (`engine/scene/layout.ts`)
- [x] Save validator allowlist'ini `worldSettings.gameMode` için güncelle. (`tools/saveValidator.ts`)
- [x] Eski layout'lar için default fallback'i `forge.defaultCamera` yap. (`normalizeGameModeId` / `resolveGameMode`)

### 2. Registry ve Runtime Boot

- [x] `src/game/gameModes/` altında registry kur. (lightweight `catalog.ts` + heavy `registry.ts`)
- [x] Built-in Game Mode ids:
  - [x] `forge.defaultCamera`
  - [x] `forge.tpsCharacter`
- [x] `RuntimeSceneApp` boot sırasında `worldSettings.gameMode` okur. (`startGameMode`)
- [x] Bilinmeyen Game Mode id varsa güvenli şekilde `forge.defaultCamera` fallback'i kullanılır.
- [x] `RuntimeSceneApp` içindeki "ilk input-move karakter player'dır" kuralını kaldır.
- [x] Game Mode lifecycle hook'ları belirle. (`GameModeSession`)
  - `createSession`
  - `spawnDefaultPawn`
  - `possess`
  - `update`
  - `dispose`

### 3. Varsayılan Camera Pawn Game Mode

- [x] `forge.defaultCamera` runtime-only camera pawn oluşturur. (`defaultCameraGameMode.ts`)
- [x] Camera pawn layout'a yazılmaz. (kamera = pawn; sahne objesi yok)
- [x] WASD camera pawn hareketine bağlanır. (`cameraControl.ts#cameraPlanarPan`, saf/test'li)
- [x] Mouse/look veya mevcut camera kontrol kararı netleştirilir.
  - **Karar:** Bu iterasyonda mouse-look yok. WASD kamerayı yatay facing yönünde
    pan eder (RTS-tarzı), sahne framing'inden gelen oryantasyon korunur.
- [x] Physics, audio ve behavior subsystem'leri çalışabilir kalır. (subsystem'ler değişmedi)
- [x] Sahnede `input-move` karakter olsa bile default camera mode otomatik possess etmez. (test'li)
- [x] Runtime kamera başlangıç pozisyonu belirlenir.
  - default scene framing (responsive viewport framing'i başlangıç pozu olur)
  - optional PlayerStart / camera start ileride (backlog)

### 4. TPS Character Game Mode

- [x] Mevcut `input-move` behavior TPS template'e taşınır veya oradan resolve edilir. (TPS mode possess eder)
- [x] Mevcut follow camera sistemi `forge.tpsCharacter` altına bağlanır. (`tpsCharacterGameMode.ts`)
- [x] Locomotion animation seçimi TPS Game Mode'a bağlı çalışır.
- [x] TPS, player karakteri explicit şekilde seçer.
  - layout'ta `metadata.player === true` tag'i öncelikli, yoksa ilk `input-move` karakter
  - PlayerStart + pawn spawn ileride (backlog)
- [x] TPS seçili değilse karakter otomatik oynatılmaz. (possess yalnızca explicit TPS seçiminde; test'li)
- [x] `input-move` script'i genel behavior olarak kalabilir ama "player" anlamına gelmez.

### 5. Editor World Settings UI

- [x] World Settings paneline Game Mode dropdown ekle. (`EditorUi.renderWorldSettings`)
- [x] İlk seçenek `Default Camera` olur. (`GAME_MODE_OPTIONS[0]`, test'li)
- [x] İkinci seçenek `TPS Character` olur.
- [x] Seçim layout `worldSettings.gameMode` alanına yazılır. (`SceneApp.applyWorldSettings`)
- [x] Undo/redo command ile değişir. (`setWorldSettings` → `executeCommand`)
- [x] Save/load round-trip test edilir. (validator gameMode testi)

### 6. Play Akışı

- [x] Editor Play düğmesi mevcut akışı korur.
  - layout kaydet
  - `/` route aç
  - runtime selected Game Mode ile başlasın (`RuntimeSceneApp.startGameMode`)
- [x] Play akışı `Preview / Simulate / Game` modlarına bölünmez. (yeni mod eklenmedi)
- [x] Runtime state layout'a otomatik yazılmaz. (session'lar layout'a yazmaz; validator runtime alanı düşürür)
- [x] Editor Mode ve Game Mode sınırı testlerle korunur. (prod build editor'ü dead-code-elimine eder)

### 7. Testler

- [x] `worldSettings.gameMode` save validator testleri.
- [x] GameMode registry fallback testi.
- [x] Default camera Game Mode testi:
  - gameMode yoksa `forge.defaultCamera`
  - `input-move` karakter otomatik possess edilmez
- [x] TPS Game Mode testi:
  - explicit seçim varsa TPS controller/follow camera bağlanır
- [x] Runtime-only state layout'a yazılmaz testi. (validator `pawnEntityId`'i düşürür)
- [x] Production dist gate:
  - `npm run build:verify` → **112 checks passed**
  - `verify:dist -- --strict` → **PASS** (dist runtime-only, editör dışlanmış)

## Durum / Notlar (2026-06-16)

- Tüm gameplay framework işi tamamlandı; `npx tsc --noEmit` temiz, `npm run build:verify`
  baştan sona yeşil (oyun bundle'ı ~46 kB, editör prod'dan dead-code-elimine).
- Yeni game-mode testleri geçiyor (catalog/registry fallback, cameraPlanarPan,
  default-camera no-possess, TPS possess + follow, metadata.player önceliği).
- **Yarım kalan rapier fizik işi de bu oturumda tamamlandı:** `simulatePhysics`
  objeleri artık düşerken devrilmiyor — dinamik gövdenin rotasyonu kilitlendi
  (`lockRotations()`) ve sync, yazılı rotasyonu koruyor (rapier'ın f32 quaternion'ını
  okumuyor; o ~1e-5° gürültü enjekte ediyordu). Düşen kutu testi (`rotation[1]==30`)
  artık tam geçiyor.
- `public/layouts/playground.json` çalışan dev server tarafından boşaltılıyor
  (sensor goal düşüyor); HEAD'den geri alındı, **commit edilmemeli**.

## Kabul Kriteri

- Play düğmesi kullanıcı açısından aynı kalır.
- Varsayılan Play, TPS karakter oynatmaz.
- Varsayılan Play, WASD ile runtime camera pawn hareket ettirir.
- World Settings'te TPS seçilirse mevcut TPS gameplay çalışır.
- GameMode/Pawn/Controller kavramları kodda açık sözleşme olarak görünür.
- Editor code Game Mode'a import edilmez.
- Runtime state layout'a otomatik kaydedilmez.
