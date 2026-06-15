# 3DGameDev Mimari Plani - Source Extract

Source: `C:\Users\emret\Downloads\3DGameDev Mimari Planı.docx`
Imported: 2026-06-14

> This file is a text extraction of the architecture reference document used for the architecture-v2 migration. Treat this file as the source reference.

3DGameDev Mimari Planı


## 1. Projenin Kimliği

3DGameDev, Three.js tabanlı web oyunları üretmek için geliştirilen, Unreal mimarisinden ilham alan fakat web oyunları için sadeleştirilmiş bir oyun motoru ve editör sistemidir.

Bu proje Unity veya Unreal gibi genel amaçlı dev bir motor olmayı hedeflemez. Hedef, tek geliştirici veya küçük ekip tarafından üretilecek 3D web oyunlarında tekrar eden sistemleri yeniden yazmadan kullanabilmektir.

3DGameDev’in ana fikri şudur:

Render işlemleri Three.js üzerinden yapılır.

Fizik işlemleri Rapier üzerinden yapılır.

Ses sistemi Web Audio API üzerine kurulur.

Input sistemi keyboard, mouse, touch ve gamepad girişlerini soyutlar.

Asset import sistemi glTF, texture ve audio dosyalarını runtime formatına hazırlar.

Script sistemi TypeScript behavior layer olarak çalışır.

Build sistemi final web runtime paketini üretir.

Editor yalnızca geliştirme zamanında kullanılır.

Final oyunda editor UI, gizmo, launcher, docs, GDD ve raw authoring dosyaları bulunmaz.

Bu proje bir “her şeyi sıfırdan yazan motor” değildir. Doğru kütüphaneleri tek bir oyun üretim mimarisinde birleştiren, tekrar kullanılabilir bir web oyun motorudur.


## 2. Temel Tasarım Kararı

Bu projede Unreal’ın özellikleri değil, mimari ayrımları örnek alınır.

Kopyalanacak fikirler:

Editor ve Runtime ayrımı

Actor/Component benzeri Entity/Component mimarisi

GameInstance, World, Level, GameMode gibi yaşam döngüsü rolleri

Subsystem mantığı

Asset Registry

Scene ve Prefab ayrımı

Cook/Build/Package benzeri çıktı süreci

Modüler motor katmanları

Editor-only ve runtime-only kod ayrımı

Kopyalanmayacak şeyler:

Blueprint sistemi

Node graph sistemi

Shader editor

Genel amaçlı animation state machine editorü

Terrain editor

Marketplace/plugin ekosistemi

Multiplayer replication sistemi

Genel amaçlı UI designer

Unreal kadar büyük reflection sistemi

Her oyun türünü destekleme iddiası

Bu motorun amacı, bütün oyun türlerini desteklemek değil; web tabanlı 3D oyunları hızlı, temiz ve tekrar edilebilir şekilde üretmektir.


## 3. Proje Modeli: Kopyalanabilir/Forklanabilir Motor

3DGameDev başlangıçta bağımsız bir base motor olarak geliştirilir. Motor belli bir olgunluğa ulaştıktan sonra yeni oyun projeleri bu base projenin kopyası alınarak başlatılabilir.

Bu bilinçli bir tasarım kararıdır.

Amaç, editör ve oyun projesini ayrı klasörlerde haberleştirmeye çalışmak yerine, her oyun projesinin kendi içinde çalışan tam bir üretim ortamına sahip olmasıdır.

Bu modelde şu kabul edilir:

Her oyun, 3DGameDev’in bir kopyası/fork’u olabilir.

O oyuna özel gelişmeler base motora geri taşınmak zorunda değildir.

Gerçekten değerli ve tekrar kullanılabilir geliştirmeler base motora daha sonra manuel olarak aktarılabilir.

Her oyun kendi ihtiyaçlarına göre motoru özelleştirebilir.

Öncelik teorik mükemmel mimari değil, oyun çıkarabilen pratik üretim hattıdır.

Ancak kopya/fork modelinde bile klasör sınırları korunmalıdır.

Önerilen proje yapısı:

3DGameDev/
  engine/
    core/
    scene/
    render-three/
    physics-rapier/
    audio/
    input/
    assets/
    scripting/

  editor/
    core/
    gizmos/
    inspector/
    level-design/
    importer/
    panels/
    viewport/

  builder/
    web/

  game/
    modes/
    controllers/
    pawns/
    systems/
    ui/

  project/
    project.3dgdev.json
    build.profile.json
    scenes/
    prefabs/
    assets/
    scripts/
    settings/

  raw-assets/
    models/
    textures/
    audio/
    documents/

  library/
    imported/
    thumbnails/
    cache/
    generated/

  cooked/
    runtime-manifest.json
    assets/
    scenes/
    scripts/

  dist/
    index.html
    game.js
    assets/

  docs/
    ARCHITECTURE.md
    ROADMAP.md
    AI_CODING_RULES.md

Kural:

engine/      -> mümkün olduğunca genel ve tekrar kullanılabilir kalır
editor/      -> sadece geliştirme zamanında kullanılır
game/        -> oyuna özel gameplay kodu
project/     -> manifest, scene, prefab, script ve ayarlar
raw-assets/  -> kaynak/authoring dosyaları
library/     -> import edilmiş ara dosyalar
cooked/      -> runtime için hazırlanmış dosyalar
dist/        -> final yayınlanabilir web oyunu

Final build yalnızca dist/ klasörünü üretir. editor/, docs/, raw-assets/, library/, gdd, launcher ve authoring dosyaları final oyuna girmez.


## 4. Motorun Ana Modülleri

3DGameDev modüler düşünülmelidir. Modül ayrımı yalnızca klasör düzeni değildir; bağımlılıkları kontrol altında tutmak için temel mimari disiplindir.

Ana modüller:

engine-core
engine-scene
engine-render-three
engine-physics-rapier
engine-audio
engine-input
engine-assets
engine-scripting

editor-core
editor-gizmos
editor-inspector
editor-level-design
editor-importer

builder-web

Her modülün sınırı net olmalıdır.


## 5. Modül Sorumlulukları


### 5.1 engine-core

Motorun en temel çekirdeğidir.

Sorumlulukları:

EngineApp yaşam döngüsü

GameInstance oluşturma

World yönetimi

Subsystem kayıt ve erişim sistemi

Event bus

Tick/update döngüsü

Zaman yönetimi

Genel hata/log sistemi

Dependency sınırları

Runtime/editor ayrımında ortak kullanılan tipler

Bu modül Three.js, Rapier veya editor UI bilmemelidir.

Örnek kavramlar:

EngineApp
GameInstance
World
Subsystem
ServiceLocator / Registry
EngineEventBus
Time
Logger


### 5.2 engine-scene

Scene, level, entity ve component sisteminden sorumludur.

Sorumlulukları:

Entity oluşturma/silme

Component ekleme/kaldırma

Transform hiyerarşisi

Scene dosyasını yükleme/kaydetme

Prefab instance sistemi

Scene graph

Component serialization

Scene lifecycle

Bu modül render motorunu doğrudan yönetmemelidir. Renderable olan entity’ler render modülüne event veya component query ile bildirilmelidir.

Temel kavramlar:

Scene
Level
Entity
Component
TransformComponent
Prefab
PrefabInstance
SceneSerializer
ComponentRegistry


### 5.3 engine-render-three

Three.js adapter katmanıdır.

Sorumlulukları:

Three.js renderer oluşturma

Runtime kamera yönetimi

Light yönetimi

Mesh render componentlerini Three.js objelerine dönüştürme

Material yönetimi

Shadow ayarları

Postprocess pipeline

Render loop entegrasyonu

Selection/debug render için editor’e API sağlama

Bu modül Rapier’i bilmemelidir. Fizik gövdeleri veya collider’lar doğrudan burada oluşturulmamalıdır.

Temel kavramlar:

ThreeRenderBackend
RenderWorld
RenderSceneAdapter
MeshRendererComponent
CameraComponent
LightComponent
MaterialRegistry
RenderPipeline


### 5.4 engine-physics-rapier

Rapier adapter katmanıdır.

Sorumlulukları:

Rapier world oluşturma

Rigidbody oluşturma

Collider oluşturma

Physics step

Raycast

Trigger/collision eventleri

Entity transform sync

Physics debug data üretme

Bu modül Three.js meshlerini doğrudan yönetmemelidir. Sadece entity/component sistemiyle çalışmalıdır.

Temel kavramlar:

RapierPhysicsBackend
PhysicsWorld
RigidBodyComponent
ColliderComponent
CharacterControllerComponent
PhysicsMaterial
PhysicsDebugData

Kural:

Oyun kodu doğrudan Rapier API’sine bağımlı olmamalıdır.
Oyun kodu engine physics interface’i ile konuşmalıdır.


### 5.5 engine-audio

Web Audio API üzerine kurulan ses sistemidir.

Sorumlulukları:

AudioContext yönetimi

Sound asset yükleme

One-shot ses çalma

Loop/ambience çalma

Music layer

Volume bus sistemi

Master/SFX/Music/Ambience grupları

3D positional audio

Fade in/out

Scene değişiminde ses temizliği

Temel kavramlar:

AudioSubsystem
AudioSourceComponent
AudioListenerComponent
SoundAsset
AudioBus
MusicManager
AmbienceManager

Minimum bus yapısı:

Master
  Music
  SFX
  UI
  Ambience


### 5.6 engine-input

Input soyutlama katmanıdır.

Sorumlulukları:

Keyboard input

Mouse input

Touch input

Gamepad input

Action mapping

Axis mapping

Editor input ve runtime input ayrımı

Pointer lock desteği

Kamera kontrol inputları

Temel kavramlar:

InputSubsystem
InputAction
InputAxis
InputMap
InputContext
PointerState
GamepadState

Örnek:

{
  "actions": {
    "jump": ["Space"],
    "interact": ["KeyE", "MouseLeft"],
    "pause": ["Escape"]
  },
  "axes": {
    "moveX": ["KeyA:-1", "KeyD:1"],
    "moveY": ["KeyS:-1", "KeyW:1"]
  }
}


### 5.7 engine-assets

Asset registry ve import edilmiş runtime assetlerin yönetiminden sorumludur.

Sorumlulukları:

Asset ID sistemi

Asset metadata

Asset dependency graph

Lazy loading

Scene bazlı asset listesi

Prefab assetleri

Model/texture/audio referansları

Runtime manifest üretimine veri sağlama

Temel kavramlar:

AssetRegistry
AssetDatabase
AssetRef
AssetMetadata
AssetDependencyGraph
AssetLoader
RuntimeManifest

Kural:

Runtime doğrudan dosya yolu ile değil, AssetRef ile çalışmalıdır.

Yanlış:

loadModel("/models/tree.glb")

Doğru:

loadAsset("asset:model/tree_oak")


### 5.8 engine-scripting

TypeScript behavior layer sistemidir.

Sorumlulukları:

Entity’ye script component bağlama

Script lifecycle

update/tick çağrıları

Event dinleme

GameMode scriptleri

Controller scriptleri

Custom component data

Runtime-safe script yükleme

Temel kavramlar:

ScriptComponent
Behavior
GameMode
Controller
Pawn
ScriptRegistry
ScriptContext

Önerilen lifecycle:

onCreate()
onStart()
onUpdate(deltaTime)
onFixedUpdate(fixedDeltaTime)
onDestroy()
onEnable()
onDisable()

Script sistemi başlangıçta basit tutulmalıdır. Node graph, visual scripting veya Blueprint benzeri sistem yapılmamalıdır.


## 6. Editor Modülleri


### 6.1 editor-core

Editor uygulamasının temelidir.

Sorumlulukları:

Editor boot

Editor state

Proje açma

Scene açma/kaydetme

Panel layout

Komut sistemi

Undo/redo altyapısı

Selection state

Editor event bus

Temel kavramlar:

EditorApp
EditorState
EditorCommand
UndoRedoStack
SelectionManager
EditorEventBus


### 6.2 editor-gizmos

Viewport içindeki manipülasyon araçlarından sorumludur.

Sorumlulukları:

Transform gizmo

Move/rotate/scale

Grid snap

Angle snap

Object pivot

Selection outline

Helper render

Camera navigation

Temel kavramlar:

TransformGizmo
SelectionOutline
GridHelper
SnapSettings
EditorCameraController


### 6.3 editor-inspector

Seçili entity, component ve asset ayarlarını düzenler.

Sorumlulukları:

Entity properties

Component properties

Add/remove component

Asset reference picker

Prefab override gösterimi

Validation warningleri

Property serialization

Temel kavramlar:

InspectorPanel
PropertyEditor
ComponentEditor
AssetPicker
ValidationMessage


### 6.4 editor-level-design

Level tasarımına özel araçlardır.

Sorumlulukları:

Entity placement

Prefab placement

Grid/snap placement

Object palette

Level hierarchy

Scene outliner

Play-in-editor başlatma

Runtime/editor mode geçişi

Temel kavramlar:

LevelEditor
PlacementTool
PrefabPalette
SceneOutliner
PlayModeController


### 6.5 editor-importer

Raw assetleri motorun anlayacağı hale getiren editör katmanıdır.

Sorumlulukları:

glTF/GLB import

Texture import

Audio import

Thumbnail üretimi

Metadata üretimi

Collider generation tetikleme

Asset registry güncelleme

Import ayarları

Temel kavramlar:

ImporterRegistry
ModelImporter
TextureImporter
AudioImporter
ThumbnailGenerator
ImportSettings


## 7. Builder Modülü


### 7.1 builder-web

Final web oyun paketini üretir.

Sorumlulukları:

Runtime-only build

Editor kodunu dışarıda bırakma

Asset dependency graph üzerinden paketleme

Scene bazlı asset toplama

Raw assetleri hariç tutma

Runtime manifest üretme

Vite/Rollup build entegrasyonu

dist/ çıktısı üretme

Build pipeline aşamaları:


## 1. Validate Project
2. Build Asset Graph
3. Cook Assets
4. Compile Scripts
5. Generate Runtime Manifest
6. Bundle Runtime Code
7. Copy Runtime Assets
8. Produce dist/

Final pakete girmemesi gerekenler:

editor/
docs/
raw-assets/
library/cache/
gdd/
launcher/
*.psd
*.blend
*.fbx kaynak dosyaları
test dosyaları
AI çalışma notları

Final pakete girmesi gerekenler:

runtime engine kodu
oyun scriptleri
cooked scene dosyaları
cooked prefab dosyaları
optimized glb dosyaları
texture dosyaları
audio dosyaları
runtime-manifest.json
index.html


## 8. Unreal Benzeri Runtime Kavramları

3DGameDev içinde Unreal terminolojisinin sade web karşılıkları kullanılabilir.

EngineApp          ≈ Engine process / boot
GameInstance      ≈ oyun boyunca yaşayan global runtime
World             ≈ aktif oyun dünyası
Scene/Level        ≈ yüklenen harita
GameMode          ≈ bu level'ın kuralları
Entity            ≈ Actor/GameObject
Component         ≈ ActorComponent
Controller        ≈ input/AI karar katmanı
Pawn/Character    ≈ kontrol edilen entity
Subsystem         ≈ audio, physics, save, quest, inventory vb.


## 9. Runtime Yaşam Döngüsü

Motor açılış sırası net olmalıdır.

Önerilen runtime boot akışı:


## 1. EngineApp oluşturulur
2. Project manifest okunur
3. Core subsystemler kaydedilir
4. Asset registry yüklenir
5. Renderer backend başlatılır
6. Physics backend başlatılır
7. Audio subsystem başlatılır
8. Input subsystem başlatılır
9. GameInstance oluşturulur
10. Start scene yüklenir
11. World oluşturulur
12. GameMode başlatılır
13. Runtime loop başlar

Runtime loop:

input.update()
scripts.update(deltaTime)
physics.fixedUpdate(fixedDeltaTime)
world.syncPhysicsToTransforms()
render.update(deltaTime)
audio.update(deltaTime)
renderer.render()

Burada önemli nokta şudur:

Render loop motorun tamamı değildir.

Physics step render’dan ayrı düşünülmelidir.

Script update ve fixed update ayrılmalıdır.

Editor update ve runtime update ayrı modlarda çalışmalıdır.


## 10. Entity/Component Modeli

Entity sadece kimlik ve component taşıyıcısıdır. Davranış component ve scriptlerden gelir.

Entity örneği:

{
  "id": "entity_001",
  "name": "Player",
  "tags": ["player"],
  "components": {
    "Transform": {
      "position": [0, 1, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1]
    },
    "MeshRenderer": {
      "model": "asset:model/player"
    },
    "RigidBody": {
      "type": "dynamic",
      "mass": 1
    },
    "Collider": {
      "shape": "capsule",
      "radius": 0.35,
      "height": 1.8
    },
    "Script": {
      "behavior": "PlayerController"
    }
  }
}

Temel componentler:

TransformComponent
MeshRendererComponent
CameraComponent
LightComponent
RigidBodyComponent
ColliderComponent
AudioSourceComponent
AudioListenerComponent
ScriptComponent
MetadataComponent

Component kuralları:

Componentler serialize edilebilir olmalıdır.

Componentler mümkün olduğunca data odaklı olmalıdır.

Runtime davranışı system/subsystem/script tarafından yürütülmelidir.

Component içinde Three.js veya Rapier nesnesi doğrudan saklanmamalıdır.

Native object bağlantıları adapter katmanında tutulmalıdır.


## 11. Scene ve Prefab Sistemi

Scene, level’ın kaydedilmiş halidir.

Scene şunları içerir:

Entity listesi

Root hierarchy

Level metadata

Environment ayarları

GameMode referansı

Scene asset referansları

Lighting setup

Spawn point bilgileri

Prefab, tekrar kullanılabilir entity template’idir.

Prefab şunları içerir:

Entity/component template

Child entity yapısı

Default property değerleri

Asset referansları

Scene içinde prefab kopyası gömülmemelidir. Scene, prefab referansı ve override bilgisi taşımalıdır.

Prefab instance örneği:

{
  "id": "entity_enemy_001",
  "prefab": "prefab:enemy_basic",
  "transform": {
    "position": [10, 0, 4],
    "rotation": [0, 90, 0],
    "scale": [1, 1, 1]
  },
  "overrides": {
    "Health.max": 150,
    "AI.patrolRoute": "route_03"
  }
}

Bu yapı sayesinde aynı prefab farklı sahnelerde tekrar kullanılabilir.


## 12. Asset Pipeline

3DGameDev’de dosya sistemi gerçek kaynak değildir. Gerçek kaynak Asset Registry’dir.

Asset akışı:

raw-assets/  -> kullanıcı tarafından eklenen kaynak dosyalar
library/     -> import edilmiş ve cache'lenmiş dosyalar
project/     -> asset metadata ve referanslar
cooked/      -> runtime için hazırlanmış dosyalar
dist/        -> final yayın paketi

Asset türleri:

ModelAsset
TextureAsset
MaterialAsset
AudioAsset
PrefabAsset
SceneAsset
ScriptAsset
AnimationAsset

Asset ID örnekleri:

asset:model/player
asset:model/tree_oak
asset:texture/grass_01
asset:audio/ui_click
asset:scene/main_menu
asset:prefab/enemy_basic
asset:script/player_controller

Asset metadata örneği:

{
  "id": "asset:model/tree_oak",
  "type": "model",
  "source": "raw-assets/models/tree_oak.glb",
  "imported": "library/imported/models/tree_oak.glb",
  "cooked": "cooked/assets/models/tree_oak.glb",
  "dependencies": [
    "asset:texture/tree_oak_albedo"
  ],
  "importSettings": {
    "generateCollider": true,
    "generateThumbnail": true,
    "scale": 1
  }
}

Kural:

Editor raw assetleri görebilir.

Runtime raw assetleri görmez.

Runtime yalnızca cooked assetleri ve runtime manifesti kullanır.

Scene dosyası dosya yolu değil, asset id taşır.


## 13. Import Sistemi

Importer sistemi başlangıçta basit ama genişletilebilir olmalıdır.

İlk desteklenecek import tipleri:

.glb / .gltf  -> ModelImporter
.png / .jpg / .webp -> TextureImporter
.wav / .mp3 / .ogg -> AudioImporter
.ts -> ScriptImporter
.json -> Scene/Prefab importer

Model import sırasında üretilebilecek veriler:

thumbnail
bounding box
bounding sphere
mesh listesi
material listesi
animation listesi
collision önerisi
scale bilgisi

Audio import sırasında üretilebilecek veriler:

duration
channels
loop flag
bus önerisi
normalized format

Texture import sırasında üretilebilecek veriler:

dimensions
format
usage
mipmap flag
compression flag

Başlangıçta importer sistemi mükemmel olmak zorunda değildir. Ama dosya eklendiğinde asset registry güncellenmelidir.


## 14. Render Architecture

Render sistemi Three.js üzerine kurulur ama oyun kodu doğrudan Three.js sahnesine bağımlı olmamalıdır.

Ana fikir:

Render Engine -> Three.js adapter

Render modülü şunları sağlar:

createRenderer()
createRenderScene()
bindWorld(world)
createMesh(entity, meshRendererComponent)
createCamera(cameraComponent)
createLight(lightComponent)
renderFrame()
resize()
dispose()

Editor render ve runtime render ayrılmalıdır.

Runtime render:

oyun kamerası
oyun ışıkları
oyun meshleri
postprocess
shadows
materials

Editor render:

grid
gizmo
selection outline
bounding boxes
debug colliders
editor camera
helper icons

Aynı canvas/Three.js scene içinde çalışabilirler, ama mimaride iki ayrı layer olarak düşünülmelidir.

Önerilen render layer yapısı:

RuntimeLayer
EditorOverlayLayer
DebugLayer
GizmoLayer


## 15. Physics Architecture

Fizik sistemi Rapier ile çalışır. Ancak oyun kodu Rapier’e doğrudan bağlanmaz.

Ana fikir:

Physics -> Rapier adapter

Physics interface örneği:

export interface PhysicsBackend {
  init(): Promise<void>
  createWorld(options: PhysicsWorldOptions): PhysicsWorldHandle
  createRigidBody(entityId: string, options: RigidBodyOptions): RigidBodyHandle
  createCollider(entityId: string, options: ColliderOptions): ColliderHandle
  step(deltaTime: number): void
  raycast(ray: RaycastInput): RaycastHit | null
  dispose(): void
}

Physics componentleri:

RigidBodyComponent
ColliderComponent
CharacterControllerComponent
TriggerComponent

Collision eventleri:

onCollisionEnter
onCollisionStay
onCollisionExit
onTriggerEnter
onTriggerExit

Physics sync prensibi:

Transform -> Physics
Physics -> Transform

Kural:

Static objelerde Transform’dan Physics’e sync edilir.

Dynamic objelerde Physics’ten Transform’a sync edilir.

Editor modunda physics simülasyonu kapalı veya isteğe bağlı olmalıdır.

Play mode başladığında physics world runtime datasından yeniden oluşturulmalıdır.


## 16. Audio Architecture

Audio sistemi Web Audio API üzerine kurulur.

Ana fikir:

Audio -> Web Audio / AudioManager adapter

Başlangıçta yapılacak minimum özellikler:

playOneShot()
playLoop()
stop()
pause()
resume()
setVolume()
setBusVolume()
fadeIn()
fadeOut()

Componentler:

AudioSourceComponent
AudioListenerComponent

Audio bus sistemi:

Master
  Music
  SFX
  UI
  Ambience

Örnek kullanım:

audio.playOneShot("asset:audio/ui_click", {
  bus: "UI",
  volume: 0.8
})

audio.playLoop("asset:audio/forest_ambience", {
  bus: "Ambience",
  fadeIn: 2.0
})

Kural:

UI sesleri, dünya sesleri ve müzik aynı sistemde ama ayrı buslarda yönetilmelidir.

Scene değişiminde hangi seslerin duracağı açıkça belirlenmelidir.

GameInstance seviyesinde kalıcı müzik sistemi olabilir.

World seviyesinde scene’e bağlı ambience ve positional audio olabilir.


## 17. Input Architecture

Input sistemi oyunu cihaz detaylarından korur.

Ana fikir:

Input -> keyboard/mouse/touch/gamepad adapter

Input katmanları:

RawInput
InputMap
InputContext
GameplayInput
EditorInput

Örnek input contextleri:

EditorViewport
RuntimeGameplay
RuntimeUI
Paused
Dialog

Kural:

Editor input ve oyun input’u çakışmamalıdır.

Play mode başladığında runtime input context aktif olur.

Editor modunda gizmo ve viewport input context aktif olur.

Input action isimleri oyun kodunda kullanılır, fiziksel tuşlar doğrudan gameplay koduna yazılmaz.


## 18. Scripting Architecture

Script sistemi TypeScript behavior layer olarak çalışır.

Ana fikir:

Scripting -> TypeScript behavior layer

Başlangıçta scriptler statik registry ile tanımlanabilir. Dinamik hot reload daha sonra eklenebilir.

Örnek behavior:

export class RotatorBehavior extends Behavior {
  speed = 90

  onUpdate(deltaTime: number) {
    this.entity.transform.rotateY(this.speed * deltaTime)
  }
}

Script lifecycle:

onCreate
onStart
onUpdate
onFixedUpdate
onDestroy
onEnable
onDisable

Script context şunlara erişebilir:

entity
world
gameInstance
input
audio
assets
physics
events

Kural:

Scriptler editor UI bilmemelidir.

Scriptler mümkün olduğunca engine interface’leri ile çalışmalıdır.

Scriptler doğrudan DOM, Three.js scene veya Rapier world’e bağlanmamalıdır.

Oyuna özel scriptler game/ veya project/scripts/ altında olmalıdır.


## 19. GameInstance, World ve GameMode Ayrımı

GameInstance

Oyun boyunca yaşayan global runtime’dır.

Sorumlulukları:

global save data
global settings
scene transition
audio manager state
player profile
persistent systems

World

Aktif oyun dünyasıdır.

Sorumlulukları:

entity listesi
component registry
active scene
physics world
render binding
runtime systems

Scene/Level

Yüklenen haritadır.

Sorumlulukları:

entity yerleşimi
light setup
environment
spawn points
level metadata
asset references

GameMode

Level’ın kurallarını yönetir.

Sorumlulukları:

win/lose conditions
spawn rules
score rules
timer
mission flow
level-specific logic

Controller

Input veya AI karar katmanıdır.

Sorumlulukları:

input okumak
karar üretmek
pawn/character'a komut vermek

Pawn/Character

Kontrol edilen entity’dir.

Sorumlulukları:

hareket
animasyon bağlantısı
collision
kamera bağlantısı
oyuncu/düşman temsil

Bu ayrım korunmalıdır. Her şeyi tek bir Player.ts veya Game.ts içine koymak yasaktır.


## 20. Editor/Runtime Ayrımı

Bu motorun en önemli kurallarından biri:

Editor kodu runtime build'e sızmamalıdır.

Editor-only şeyler:

gizmo
inspector
outliner
asset browser
import panel
debug property editor
level placement tools
selection tools
editor camera
undo/redo

Runtime şeyler:

engine app
game instance
world
scene loading
entity/component
render
physics
audio
input
scripts
asset loading

Build sistemi bu ayrımı doğrulamalıdır.

Önerilen import kuralı:

engine/* editor/* import etmemelidir.
runtime code editor/* import etmemelidir.
editor/* engine/* import edebilir.
builder/* hem project hem engine metadata okuyabilir.


## 21. Project Manifest

Her oyun projesinin merkezi dosyası project.3dgdev.json olmalıdır.

Örnek:

{
  "name": "MyWebGame",
  "engineVersion": "0.1.0",
  "startScene": "asset:scene/main_menu",
  "defaultGameInstance": "GameInstance",
  "modules": {
    "renderer": "three",
    "physics": "rapier",
    "audio": "web-audio",
    "input": "default",
    "scripting": "typescript"
  },
  "build": {
    "target": "web",
    "mode": "production",
    "output": "dist"
  }
}

Bu dosya projenin ana kimliğidir.


## 22. Scene Dosya Formatı

Scene dosyaları JSON formatında tutulabilir.

Örnek:

{
  "id": "asset:scene/level_01",
  "name": "Level 01",
  "gameMode": "script:Level01GameMode",
  "environment": {
    "background": "#87bde8",
    "ambientLight": 0.6
  },
  "entities": [
    {
      "id": "entity_player_start",
      "name": "PlayerStart",
      "components": {
        "Transform": {
          "position": [0, 0, 0],
          "rotation": [0, 0, 0],
          "scale": [1, 1, 1]
        }
      }
    }
  ]
}

Başlangıçta JSON yeterlidir. Binary scene formatına gerek yoktur.


## 23. Build Profile

Build ayarları ayrı dosyada tutulmalıdır.

Örnek:

{
  "target": "web",
  "mode": "production",
  "includeScenes": [
    "asset:scene/main_menu",
    "asset:scene/level_01"
  ],
  "exclude": [
    "editor",
    "docs",
    "raw-assets",
    "library/cache"
  ],
  "optimization": {
    "minify": true,
    "treeShake": true,
    "compressTextures": false,
    "audioFormat": "ogg"
  }
}

Build profile sayesinde farklı çıktı tipleri üretilebilir:

development build
production build
test build
demo build


## 24. İlk Hedef: Vertical Slice Engine

İlk amaç tam motor yapmak değildir. İlk amaç küçük ama uçtan uca çalışan bir vertical slice oluşturmaktır.

Vertical slice şunu kanıtlamalıdır:

Editor açılır.
Scene oluşturulur.
Entity eklenir.
Mesh atanır.
Collider atanır.
Audio source atanır.
Script atanır.
Scene kaydedilir.
Play mode çalışır.
Physics çalışır.
Audio çalışır.
Input çalışır.
Build alınır.
dist/ klasörü editor olmadan çalışır.

Bu başarıldığında motor gerçek bir üretim hattı haline gelir.


## 25. Geliştirme Fazları


### Faz 1 — Çekirdek Mimari

Hedef:

engine-core
engine-scene
project manifest
basic runtime boot
entity/component sistemi
scene load/save

Çıktı:

Boş bir scene yüklenebilmeli.
Entity oluşturulabilmeli.
Transform component çalışmalı.
Scene JSON olarak kaydedilip geri açılabilmeli.


### Faz 2 — Render Three Adapter

Hedef:

engine-render-three
camera
light
mesh renderer
basic material
runtime render loop

Çıktı:

Scene içindeki entity Three.js ile render edilmeli.
Camera ve light componentleri çalışmalı.
Editor viewport ve runtime render ayrımı başlamalı.


### Faz 3 — Editor Temeli

Hedef:

editor-core
viewport
scene outliner
selection
inspector
basic transform editing

Çıktı:

Editor içinde entity seçilebilmeli.
Transform değerleri inspector’dan değiştirilebilmeli.
Scene kaydedilebilmeli.


### Faz 4 — Gizmo ve Level Design

Hedef:

editor-gizmos
move/rotate/scale
grid snap
prefab placement başlangıcı

Çıktı:

Viewport içinde objeler taşınabilmeli.
Grid snap çalışmalı.
Basit level tasarımı yapılabilmeli.


### Faz 5 — Asset Registry ve Import

Hedef:

engine-assets
editor-importer
asset registry
model/texture/audio import
thumbnail başlangıcı

Çıktı:

GLB asset import edilmeli.
Asset ID oluşmalı.
Scene dosyası asset ID ile model referansı tutmalı.
Runtime asset ID ile modeli yüklemeli.


### Faz 6 — Physics Rapier Adapter

Hedef:

engine-physics-rapier
rigidbody
collider
raycast
physics debug

Çıktı:

Static floor ve dynamic cube çalışmalı.
Collider componentleri scene’den yüklenmeli.
Physics play mode’da çalışmalı.
Editor modunda simülasyon kontrol edilebilmeli.


### Faz 7 — Audio System

Hedef:

engine-audio
audio bus
audio source
one-shot
loop
music/ambience

Çıktı:

UI click sesi çalabilmeli.
Scene ambience loop çalabilmeli.
AudioSourceComponent ile positional audio denenebilmeli.


### Faz 8 — Input System

Hedef:

engine-input
input actions
input contexts
keyboard/mouse
touch başlangıcı
gamepad opsiyonel

Çıktı:

Runtime input ile player hareket edebilmeli.
Editor input ve runtime input ayrılmalı.


### Faz 9 — Scripting Layer

Hedef:

engine-scripting
Behavior class
ScriptComponent
GameMode
Controller
Pawn

Çıktı:

Bir entity’ye script atanabilmeli.
Script update alabilmeli.
Input okuyup entity hareket ettirebilmeli.
GameMode level kuralı çalıştırabilmeli.


### Faz 10 — Builder Web

Hedef:

builder-web
runtime manifest
cook
dist output
editor exclusion

Çıktı:

Build komutu dist/ üretmeli.
dist/ içinde editor kodu olmamalı.
Oyun standalone web paketi olarak çalışmalı.


## 26. İlk Demo Oyun Senaryosu

Motoru test etmek için çok küçük bir 3D demo oyun yapılmalıdır.

Önerilen demo:

Basit 3D oda veya küçük arena
Bir player karakter/capsule
WASD hareket
Kamera takip
Birkaç toplanabilir obje
Kapı veya hedef alan
Basit UI skor
Ses efektleri
Basit fizik collision
Kazanınca level complete

Bu demo motorun şu sistemlerini kanıtlar:

render
physics
input
audio
scene
prefab
script
build

Demo oyun fazla büyütülmemelidir. Amaç oyun yapmak değil, motor pipeline’ını doğrulamaktır.


## 27. Yapılmayacaklar Listesi

Şu listeye girilirse proje büyür ama oyun çıkmaz:

Blueprint yapayım.
Node graph yapayım.
Shader editor yapayım.
Animasyon state machine yapayım.
Terrain editor yapayım.
Marketplace gibi plugin sistemi yapayım.
Multiplayer replication yazayım.
Genel amaçlı UI designer yapayım.

Bu özellikler başlangıçta yasaktır.

Bunların yerine doğrudan oyun üretimini hızlandıracak şeylere odaklanılmalıdır:

Scene kaydet/yükle
Prefab sistemi
Asset import
Transform gizmo
Inspector
Physics adapter
Audio manager
Input action map
Script behavior
Build/export


## 28. Kod Yazım Kuralları


### 28.1 Bağımlılık Kuralları

engine-core -> hiçbir dış motor modülüne bağımlı olmamalı
engine-scene -> core'a bağımlı olabilir
engine-render-three -> core + scene + assets kullanabilir
engine-physics-rapier -> core + scene kullanabilir
engine-audio -> core + assets kullanabilir
engine-input -> core kullanabilir
engine-scripting -> core + scene + input + audio + physics interface kullanabilir
editor-* -> engine modüllerini kullanabilir
builder-web -> project + assets + engine metadata okuyabilir

Yasak:

engine-core içinde Three.js import etmek
engine-core içinde Rapier import etmek
runtime kodunda editor import etmek
gameplay script içinde inspector/gizmo import etmek
scene JSON içinde mutlak dosya yolu kullanmak


### 28.2 Interface Önce, Backend Sonra

Her büyük sistem önce interface ile tanımlanmalıdır.

Örnek:

RenderBackend interface
ThreeRenderBackend implementation

PhysicsBackend interface
RapierPhysicsBackend implementation

AudioBackend interface
WebAudioBackend implementation

Bu sayede oyun kodu backend detaylarına kilitlenmez.


### 28.3 Data ve Runtime Object Ayrımı

Serialize edilen data ile runtime nesnesi ayrılmalıdır.

Yanlış:

component.threeMesh = new THREE.Mesh()

Doğru:

component.model = "asset:model/crate"
renderAdapter.bind(entity, component)

Component data taşır. Adapter runtime object yaratır.


### 28.4 Editor State ve Runtime State Ayrımı

Editor selection, inspector, undo/redo gibi şeyler runtime state’e karışmamalıdır.

Yanlış:

{
  "id": "box_01",
  "selected": true,
  "inspectorExpanded": true
}

Doğru:

selected bilgisi EditorState içinde tutulur.
Scene dosyasına yazılmaz.


## 29. Claude + Codex ile Çalışma Kuralları

Bu proje AI destekli geliştirileceği için görevler küçük ve net parçalara bölünmelidir.

Her görev şu formatta verilmelidir:

Amaç:
Kapsam:
Dokunulacak dosyalar:
Dokunulmayacak dosyalar:
Kabul kriterleri:
Test senaryosu:

Örnek görev:

Amaç:
engine-core içinde EngineApp ve SubsystemRegistry yapısını kur.

Kapsam:
- EngineApp class
- Subsystem interface
- SubsystemRegistry
- init/start/update/dispose lifecycle

Dokunulacak dosyalar:
- engine/core/EngineApp.ts
- engine/core/Subsystem.ts
- engine/core/SubsystemRegistry.ts

Dokunulmayacak dosyalar:
- editor/
- render-three/
- physics-rapier/

Kabul kriterleri:
- EngineApp subsystem kaydedebilmeli.
- init sırası deterministic olmalı.
- update(deltaTime) çağrısı subsystemlere iletilmeli.
- dispose çağrısı ters sırayla çalışmalı.

AI’ya geniş ve belirsiz görev verilmemelidir.

Yanlış prompt:

Bana oyun motoru mimarisini kur.

Doğru prompt:

engine-scene içinde Entity, Component ve TransformComponent sistemini kur.
Serialization şimdilik sadece JSON plain object dönsün.
Three.js veya Rapier import etme.


## 30. Öncelik Sırası

İlk etapta yapılacaklar:


## 1. Klasör yapısını oluştur
2. project.3dgdev.json oluştur
3. engine-core boot sistemi
4. subsystem registry
5. engine-scene entity/component sistemi
6. transform component
7. scene serializer
8. Three render adapter
9. editor viewport
10. inspector ile transform edit
11. asset registry
12. GLB import
13. prefab sistemi
14. Rapier physics adapter
15. Web audio manager
16. input action map
17. scripting behavior
18. web builder

Bu sıranın dışına çıkılmamalıdır. Özellikle render güzel görünsün diye postprocess, shader veya özel efektlere erken girilmemelidir.


## 31. Başarı Kriterleri

Bu mimari başarılı sayılırsa şunlar mümkün olmalıdır:

Yeni oyun projesi base 3DGameDev kopyasıyla başlatılır.
Editor içinde yeni scene oluşturulur.
Asset import edilir.
Prefab oluşturulur.
Level tasarımı yapılır.
Player scripti eklenir.
Physics ve audio componentleri çalışır.
Play mode içinde oyun test edilir.
Build alınır.
dist/ klasörü bağımsız web oyunu olarak çalışır.

İkinci oyun yapılırken başarı kriteri daha nettir:

İkinci oyunda render, fizik, ses, input, scene, prefab ve build sistemi yeniden yazılmaz.
Sadece oyun kuralları, assetler, levellar ve gameplay scriptleri değişir.


## 32. Nihai İlke

3DGameDev’in hedefi dev bir motor yapmak değildir.

Hedef:

Tek geliştiricinin web tabanlı 3D oyunları hızlı üretmesini sağlayan,
Three.js + Rapier + Web Audio + TypeScript üzerine kurulu,
Unreal mimari ayrımlarından ilham alan,
editor-runtime-build ayrımı net,
kopyalanabilir/forklanabilir,
hafif ama düzenli bir web oyun motoru oluşturmaktır.

Bu motorun değeri özellik sayısıyla değil, ikinci ve üçüncü oyunu daha hızlı başlatmasıyla ölçülür.
