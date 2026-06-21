# Player Character Requirements - Rapor & Checklist

> Tarih: 2026-06-21
> Kapsam: `public/assets/starter-content/Script/Player.actor.json` uzerinden
> Unreal benzeri bir oynanabilir Character insa etmek icin gereken veri modeli,
> runtime, editor ve tooling ihtiyaclarini belirlemek.
>
> Temel karar: Forge, Unreal'in Character sinifini birebir kopyalamaz; ama
> ayrimi alir. `Character` parent class secildiginde mesh tek basina yetmez.
> Character; possess edilebilen Pawn + skeletal mesh + capsule collision +
> Character Movement + animasyon/kamera sozlesmesi olarak calismalidir.

---

## Kaynaklar

- Unreal Gameplay Framework: https://dev.epicgames.com/documentation/unreal-engine/gameplay-framework-in-unreal-engine
- Unreal Gameplay Framework Quick Reference: https://dev.epicgames.com/documentation/unreal-engine/gameplay-framework-quick-reference-in-unreal-engine
- Unreal Characters: https://dev.epicgames.com/documentation/unreal-engine/characters-in-unreal-engine
- Unreal Movement Components: https://dev.epicgames.com/documentation/unreal-engine/movement-components-in-unreal-engine
- Unreal Setting Up a Character: https://dev.epicgames.com/documentation/unreal-engine/setting-up-a-character-in-unreal-engine
- Unreal Player-Controlled Cameras: https://dev.epicgames.com/documentation/unreal-engine/quick-start-guide-to-player-controlled-cameras-in-unreal-engine-cpp
- Forge onceki calisma: `docs/completed/ACTOR_SCRIPT_SYSTEM_CHECKLIST.md`
- Forge onceki calisma: `docs/completed/SCRIPT_COMMUNICATION_SYSTEM_CHECKLIST.md`

---

## Unreal'dan Alinan Ders

Unreal Gameplay Framework'te oyuncu tek bir obje degildir:

- `GameMode` oyun kurallarini ve oyuncunun nasil spawn edilecegini belirler.
- `PlayerController` oyuncu input iradesini temsil eder.
- `Pawn` oyuncunun veya AI'nin dunyadaki fiziksel temsilidir.
- `Character`, Pawn'in humanoid/vertical avatar icin ozellesmis halidir.
- `Character` varsayilan olarak skeletal mesh, capsule collision ve
  `CharacterMovementComponent` tasir.
- `CharacterMovementComponent` yalnizca Character icindir; walking, falling,
  jumping, flying, swimming gibi movement mode'lari ve hiz/friction/gravity gibi
  ayarlari kapsuller.
- Kamera genelde Pawn/Character ustunde `SpringArm + Camera` komponentleriyle
  veya PlayerController/GameMode tarafinda takip edilir.

Forge karsiligi: `Player.Actor` bir reusable class/prefab olacak; World Settings
veya GameMode bu class'i default pawn olarak sececek; PlayerController onu
possess edecek; CharacterMovement komponenti input'u transform/physics/animation
durumuna cevirecek.

---

## Mevcut Forge Durumu

`public/assets/starter-content/Script/Player.actor.json` bugun:

```json
{
  "type": "actor",
  "name": "Player",
  "parentClass": "character",
  "components": [
    { "id": "root", "component": "Transform", "props": {} },
    {
      "id": "meshRenderer",
      "component": "MeshRenderer",
      "props": { "assetId": "character-a" },
      "parent": "root"
    }
  ]
}
```

Bu dogru baslangic, ama oynanabilir Character degil. Eksikler:

- Capsule/body collision yok.
- Character Movement sozlesmesi yok.
- PlayerController possession baglantisi yok.
- GameMode asset'i default pawn olarak `Player.Actor` secebilir durumda degil.
- Actor Script `parentClass: "character"` runtime'da henuz GameMode'un
  possess edebilecegi `RuntimeCharacterRef` akisine tam girmiyor.
- Actor Script karakterleri icin locomotion animation/camera takip sozlesmesi
  legacy `layout.characters` kadar birinci sinif degil.

Forge tarafinda hazir kullanilabilecek parcalar:

- Actor Script class/instance sistemi: `*.actor.json`, `LayoutActorInstance`,
  `actorInstanceToEntity`.
- Script communication: direct reference, interfaces, dispatchers,
  messageBindings, `BehaviorContext.messages/world/state`.
- GameMode temeli: `src/game/gameModes/types.ts`, `defaultCameraGameMode`,
  `tpsCharacterGameMode`, `worldSettings.gameMode`.
- Hareket cekirdegi: `src/game/playerMovement.ts`,
  `src/game/verticalMotion.ts`, `src/game/collision.ts`.
- Animasyon secimi: `src/game/locomotionAnimation.ts`.
- Kamera takip matematigi: `src/game/followCamera.ts`.

---

## Mimari Karar

### 1. CharacterMovement birinci sinif component olmali

`input-move` gibi serbest bir Behavior Script, Player karakteri icin yeterli
degil. O davranis mevcut prototip icin iyi; fakat Character parent class'in
Unreal benzeri beklentisi daha guclu:

```text
Character = Pawn + Capsule + Skeletal Mesh + CharacterMovement
```

Bu nedenle Forge'a yeni bir Actor Script component kind eklenmeli:

```ts
CharacterMovement
```

Ilk props taslagi:

```jsonc
{
  "maxWalkSpeed": 3,
  "sprintMultiplier": 2,
  "jumpSpeed": 4,
  "gravityScale": 1,
  "airControl": 0.25,
  "acceleration": 30,
  "brakingDeceleration": 24,
  "groundFriction": 8,
  "orientRotationToMovement": true,
  "movementMode": "walking",
  "capsuleRadius": 0.3,
  "capsuleHalfHeight": 0.9
}
```

Bu component game-specific ability degil; reusable movement primitive'dir.
Game-specific kosma, dash, attack, inventory gibi mekanikler yine Behavior
Script ve Script Communication ile kurulmalidir.

### 2. Character parent class default komponent seed etmeli

Content Browser'da `Script -> Character` secildiginde veya mevcut
`Player.Actor` compile edildiginde editor su minimum yapiyi beklemeli:

```jsonc
[
  { "id": "root", "component": "Transform", "props": {} },
  {
    "id": "capsule",
    "parent": "root",
    "component": "Collider",
    "props": {
      "shape": "capsule",
      "size": [0.6, 1.8, 0.6],
      "center": [0, 0.9, 0],
      "isStatic": false,
      "isSensor": false,
      "simulatePhysics": false
    }
  },
  {
    "id": "meshRenderer",
    "parent": "root",
    "component": "MeshRenderer",
    "props": { "assetId": "character-a" }
  },
  {
    "id": "characterMovement",
    "parent": "root",
    "component": "CharacterMovement",
    "props": {
      "maxWalkSpeed": 3,
      "sprintMultiplier": 2,
      "jumpSpeed": 4,
      "orientRotationToMovement": true
    }
  }
]
```

### 3. Movement input Controller'dan gelmeli

CharacterMovement component dogrudan klavye tuslarini bilmemeli. Akis:

```text
PlayerController
  -> ActionMap / input vector
  -> possessed Pawn/Character
  -> CharacterMovement
  -> Transform + movement state
  -> Animation + camera
```

Bu, mevcut `isPlayerControlled(entityId)` kuralinin dogru yonde oldugunu
gosterir. Eksik kisim: `parentClass: "character"` Actor Script instance'larinin
da possession adaylari arasina girmesi.

### 4. GameMode asset'i gercek default pawn secebilmeli

Kullanici `MyGameMode.actor.json` gibi bir `parentClass: "gameMode"` asset'i
olusturmus. Bugun bu sadece Actor Script kabugu. Hedefte GameMode asset'i su
alanlari tasimali:

```jsonc
{
  "parentClass": "gameMode",
  "variables": [
    {
      "key": "defaultPawnClassRef",
      "type": "text",
      "default": "assets/starter-content/Script/Player.actor.json"
    },
    {
      "key": "playerController",
      "type": "select",
      "default": "defaultPlayerController"
    }
  ]
}
```

World Settings sadece built-in `forge.tpsCharacter` degil, proje GameMode
asset'lerini de secebilmelidir. Runtime bu GameMode'u resolve edip
`Player.Actor` class'ini Player Start'ta spawn etmelidir.

### 5. Actor Script character'lar legacy character kadar birinci sinif olmali

Mevcut TPS GameMode `RuntimeCharacterRef[]` uzerinden legacy
`layout.characters` icinden player seciyor. Actor Script ile uretilen
`actor:<i>` entity'leri de su runtime ref akisine girmeli:

```ts
RuntimePawnRef / RuntimeCharacterRef
  entityId
  classRef
  parentClass
  object
  gltf
  movementComponent
  placement transform
```

Boylece `Player.Actor` sahneye kondugunda veya GameMode tarafindan spawn
edildiginde animasyon, takip kamera ve possession ayni yoldan calisir.

---

## Ihtiyac Duyulan Bilesenler

### Runtime data/components

- `CharacterMovementComponent`: hiz, jump, gravity scale, acceleration, friction,
  air control, orient-to-movement, active movement mode.
- `Collider` capsule preset: Character icin zorunlu hareket collision footprint.
- `MeshRenderer`: skeletal mesh asset ref; mevcut `character-a` yeterli baslangic.
- `Camera` / `SpringArm` komponentleri: ilk fazda GameMode camera config olarak
  kalabilir; sonraki fazda Actor Script component olarak eklenmeli.
- `Possessable` veya parentClass tabanli pawn marker: actor'un Controller
  tarafindan sahiplenilebilir oldugunu runtime'a acik gostermeli.
- Runtime movement state: velocity, grounded, movementMode, lastInputVector.
  Layout'a yazilmaz.

### Runtime systems

- CharacterMovement runner: mevcut `playerMovement`, `verticalMotion` ve
  `collision` helper'larini CharacterMovement props ile kullanir.
- Possession resolver: GameMode -> PlayerController -> defaultPawnClassRef veya
  sahnedeki player-tagged pawn.
- Actor Script character spawn bridge: `actorInstanceToEntity` sonucu render,
  physics, behavior, animation ve GameMode possession listesine dahil olur.
- Animation bridge: movement state -> `locomotionAnimation` -> skeletal mesh clip.
- Camera bridge: TPS follow camera veya ileride SpringArm/Camera component.

### Editor/tooling

- ActorScriptEditor Add menu: `Movement -> Character Movement`.
- Character parent class auto-seed: Transform + Capsule + MeshRenderer +
  CharacterMovement.
- Details panel: CharacterMovement icin typed form, ham JSON degil.
- Compile warnings:
  - Character parent class ama CharacterMovement yok.
  - CharacterMovement var ama capsule collider yok.
  - CharacterMovement var ama parentClass character/pawn degil.
  - GameMode default pawn classRef yok veya Character/Pawn degil.
  - Player.Actor skeletal mesh asset'i manifestte bulunamiyor.
- World Settings: built-in GameMode listesine ek olarak project GameMode asset'i
  secimi.
- Player Start: default pawn spawn testinin editor tarafinda gorunur olmasi.
- Runtime debug: possessed pawn id/classRef, movement mode, velocity, grounded,
  active GameMode/Controller.

---

## Player.Actor Hedef Sekli

Kisa vadede hedef dosya kabaca su anlama gelmeli:

```jsonc
{
  "schema": 1,
  "type": "actor",
  "name": "Player",
  "parentClass": "character",
  "components": [
    { "id": "root", "component": "Transform", "props": {} },
    {
      "id": "capsule",
      "parent": "root",
      "component": "Collider",
      "props": {
        "shape": "capsule",
        "size": [0.6, 1.8, 0.6],
        "center": [0, 0.9, 0],
        "isStatic": false,
        "isSensor": false
      }
    },
    {
      "id": "meshRenderer",
      "parent": "root",
      "component": "MeshRenderer",
      "props": { "assetId": "character-a" }
    },
    {
      "id": "characterMovement",
      "parent": "root",
      "component": "CharacterMovement",
      "props": {
        "maxWalkSpeed": 3,
        "sprintMultiplier": 2,
        "jumpSpeed": 4,
        "gravityScale": 1,
        "orientRotationToMovement": true
      }
    }
  ]
}
```

Not: Bu dokuman Player.Actor dosyasini degistirmez. Once schema/runtime/editor
destegi gelmeli; aksi halde bilinmeyen `CharacterMovement` component'i validator
ve runtime tarafinda duser veya etkisiz kalir.

---

## Checklist

Durum: `[ ]` yapilmadi, `[~]` devam ediyor, `[x]` tamam.

### Faz 0 - Karar ve kapsam

- [x] Unreal Gameplay Framework / Character / CharacterMovement modelini ozetle.
- [x] Mevcut Forge Player.Actor durumunu tespit et.
- [x] `CharacterMovement` komponentinin gerekli oldugunu mimari karar olarak
      kaydet.
- [x] Kod degisikligi yapmadan gereksinim dokumanini olustur.

### Faz 1 - Veri modeli ve validator

- [x] `engine/scene/components.ts` icine `CharacterMovementComponent` tipi ve
      read helper ekle.
- [x] `engine/scene/actorScript.ts` `ACTOR_COMPONENT_KINDS` listesine
      `CharacterMovement` ekle.
- [x] `tools/saveValidator.ts` allowlist/normalize/validate akisini guncelle.
- [x] Character parent class default seed'ini Transform + Capsule + MeshRenderer
      + CharacterMovement yap.
- [x] Headless tests: normalize, save payload, invalid props fallback.

### Faz 2 - Editor UX

- [x] ActorScriptEditor Add menu altina `Movement -> Character Movement` ekle.
- [x] CharacterMovement Details formu: speed, sprint, jump, gravityScale,
      acceleration, braking, airControl, orientRotationToMovement.
- [x] Character compile warnings: missing capsule, missing movement, invalid
      parent, missing mesh.
- [x] MeshRenderer asset picker skeletal mesh icin `character-a` gibi asset'leri
      net gostermeli.

### Faz 3 - Runtime movement bridge

- [x] Actor Script character instance'lari GameMode possession adaylarina dahil
      olsun (`actor:<i>` RuntimeCharacterRef/RuntimePawnRef).
- [x] CharacterMovement runner mevcut pure helper'lari kullanarak
      possessed pawn'u hareket ettirsin.
- [x] Input PlayerController'dan gelsin; unpossessed CharacterMovement hareket
      etmesin.
- [x] Capsule collider half-extents hareket collision icin kullanilsin.
- [x] Runtime state `context.state` veya movement subsystem state icinde kalsin;
      layout'a yazilmasin.

### Faz 4 - GameMode asset entegrasyonu

- [ ] `parentClass: "gameMode"` Actor Script asset'leri World Settings'te
      secilebilir olsun.
- [ ] GameMode asset'i `defaultPawnClassRef` ile `Player.Actor` secebilsin.
- [ ] Runtime Player Start'ta default pawn classRef spawn edebilsin.
- [ ] Built-in `forge.tpsCharacter` korunur; project GameMode asset'i opt-in
      olur.

### Faz 5 - Camera ve animation

- [ ] Actor Script character'lar locomotion animation bridge'ine dahil olsun.
- [ ] Movement state -> idle/walk/run/jump/fall clip secimi Actor Script mesh'i
      icin calissin.
- [ ] TPS takip kamera Actor Script player'i takip edebilsin.
- [ ] Sonraki faz icin `SpringArm` ve `Camera` component taslagi hazirlansin.

### Faz 6 - Debug, test ve gate

- [ ] Runtime debug panelde active GameMode, possessed pawn, movement mode,
      grounded, velocity gorunsun.
- [x] Engine tests: possession, movement, collision clamp, jump, unpossessed
      no-input.
- [x] `npm run build:verify`.
- [x] `docs/UNREAL_BASICS_LESSONS.md` progress log ve kanonik dosya listesi
      guncel kalsin.

---

## Kabul Kriteri

Bu calisma bittiginde:

- Kullanici Content Browser'da `Player.Actor` class'ini Character olarak
  duzenleyebilir.
- Player.Actor mesh + capsule + CharacterMovement tasir.
- GameMode, Player.Actor'i default pawn olarak secebilir.
- Play baslayinca Player Start'ta pawn spawn olur veya sahnedeki Player.Actor
  possess edilir.
- WASD, jump, sprint, collision clamp, locomotion animation ve takip kamera
  Actor Script player uzerinde calisir.
- Script Communication sistemi core movement icin degil, ability/interact gibi
  gameplay mesajlari icin kullanilmaya devam eder.
