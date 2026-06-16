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

- [ ] `GameModeDefinition` tipini ekle.
  - `id`
  - `displayName`
  - `defaultPawn`
  - `playerController`
  - optional `description`
- [ ] `PawnDefinition` tipini ekle.
  - `id`
  - `kind: "camera" | "character"`
  - optional movement/camera config
- [ ] `PlayerControllerDefinition` tipini ekle.
  - `id`
  - input action mapping contract
  - possess target contract
- [ ] Runtime-only `PlayerState` ve `GameState` veri yüzeylerini tanımla.
- [ ] `worldSettings.gameMode?: string` alanını resmi schema parçası yap.
- [ ] Save validator allowlist'ini `worldSettings.gameMode` için güncelle.
- [ ] Eski layout'lar için default fallback'i `forge.defaultCamera` yap.

### 2. Registry ve Runtime Boot

- [ ] `src/game/gameModes/` altında registry kur.
- [ ] Built-in Game Mode ids:
  - [ ] `forge.defaultCamera`
  - [ ] `forge.tpsCharacter`
- [ ] `RuntimeSceneApp` boot sırasında `worldSettings.gameMode` okur.
- [ ] Bilinmeyen Game Mode id varsa güvenli şekilde `forge.defaultCamera` fallback'i kullanılır.
- [ ] `RuntimeSceneApp` içindeki "ilk input-move karakter player'dır" kuralını kaldır.
- [ ] Game Mode lifecycle hook'ları belirle.
  - `createSession`
  - `spawnDefaultPawn`
  - `possess`
  - `update`
  - `dispose`

### 3. Varsayılan Camera Pawn Game Mode

- [ ] `forge.defaultCamera` runtime-only camera pawn oluşturur.
- [ ] Camera pawn layout'a yazılmaz.
- [ ] WASD camera pawn hareketine bağlanır.
- [ ] Mouse/look veya mevcut camera kontrol kararı netleştirilir.
- [ ] Physics, audio ve behavior subsystem'leri çalışabilir kalır.
- [ ] Sahnede `input-move` karakter olsa bile default camera mode otomatik possess etmez.
- [ ] Runtime kamera başlangıç pozisyonu belirlenir.
  - default scene framing
  - optional PlayerStart / camera start ileride

### 4. TPS Character Game Mode

- [ ] Mevcut `input-move` behavior TPS template'e taşınır veya oradan resolve edilir.
- [ ] Mevcut follow camera sistemi `forge.tpsCharacter` altına bağlanır.
- [ ] Locomotion animation seçimi TPS Game Mode'a bağlı çalışır.
- [ ] TPS, player karakteri explicit şekilde seçer.
  - PlayerStart + pawn spawn
  - veya layout'ta tag/metadata ile possessable character
- [ ] TPS seçili değilse karakter otomatik oynatılmaz.
- [ ] `input-move` script'i genel behavior olarak kalabilir ama "player" anlamına gelmez.

### 5. Editor World Settings UI

- [ ] World Settings paneline Game Mode dropdown ekle.
- [ ] İlk seçenek `Default Camera` olur.
- [ ] İkinci seçenek `TPS Character` olur.
- [ ] Seçim layout `worldSettings.gameMode` alanına yazılır.
- [ ] Undo/redo command ile değişir.
- [ ] Save/load round-trip test edilir.

### 6. Play Akışı

- [ ] Editor Play düğmesi mevcut akışı korur.
  - layout kaydet
  - `/` route aç
  - runtime selected Game Mode ile başlasın
- [ ] Play akışı `Preview / Simulate / Game` modlarına bölünmez.
- [ ] Runtime state layout'a otomatik yazılmaz.
- [ ] Editor Mode ve Game Mode sınırı testlerle korunur.

### 7. Testler

- [ ] `worldSettings.gameMode` save validator testleri.
- [ ] GameMode registry fallback testi.
- [ ] Default camera Game Mode testi:
  - gameMode yoksa `forge.defaultCamera`
  - `input-move` karakter otomatik possess edilmez
- [ ] TPS Game Mode testi:
  - explicit seçim varsa TPS controller/follow camera bağlanır
- [ ] Runtime-only state layout'a yazılmaz testi.
- [ ] Production dist gate:
  - `npm run build:verify`
  - `verify:dist -- --strict`

## Kabul Kriteri

- Play düğmesi kullanıcı açısından aynı kalır.
- Varsayılan Play, TPS karakter oynatmaz.
- Varsayılan Play, WASD ile runtime camera pawn hareket ettirir.
- World Settings'te TPS seçilirse mevcut TPS gameplay çalışır.
- GameMode/Pawn/Controller kavramları kodda açık sözleşme olarak görünür.
- Editor code Game Mode'a import edilmez.
- Runtime state layout'a otomatik kaydedilmez.
