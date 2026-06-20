# Script Communication System - Rapor & Checklist

> Tarih: 2026-06-20
> Amaç: Actor Script'lerin, Unreal Blueprint Communication benzeri ama Forge'a uygun
> veri-sozlesmeli bir haberlesme katmani uzerinden konusmasini saglamak.
>
> Temel karar: Forge gorsel Blueprint node VM'i kopyalamaz. Actor Script verisi
> sozlesmeyi tanimlar; davranis TypeScript behavior olarak `src/game/` altinda
> yasar; Claude/Codex bu behavior kodunu yazar. Runtime tarafinda aktorler
> birbirine hardcoded host callback'leriyle degil, mesaj/interface/dispatcher
> sozlesmeleriyle baglanir.

---

## Problem

Lamba testi kucuk olcekte dogru calisti: collision overlap prompt gosterdi, E
tusu light ve particle'i tetikledi. Ancak mevcut uygulama buyuk proje icin
kalici mimari degil:

- `Interaction.action` string'i `RuntimeSceneApp` icinde ozel `if` bloklariyla
  yorumlaniyor.
- Actor Script `eventBindings` runtime'da tek `Behavior` component'e coker; coklu
  event/behavior henuz birinci sinif degil.
- Actor'ler arasi explicit referans, interface/capability, event dispatcher ve
  message binding modeli yok.
- `src/core/events.ts` icinde EventBus var, fakat Actor Script runtime
  haberlesmesine henuz bagli degil.

Bu sekilde devam edilirse her mekanik calisir gorunur ama proje buyudukce
bagimliliklar RuntimeSceneApp icine dagilir, AI tarafindan yazilan behavior'lar
farkli stillerde gizli global state uretir ve debug etmek zorlasir.

---

## Kapsam

Bu checklist'in kapsami:

- Actor Script'ler icin Direct Reference, Interface/Capability ve Event
  Dispatcher benzeri haberlesme sozlesmesi.
- BehaviorContext'e kontrollu mesaj, world query ve per-entity runtime state API'i.
- Runtime'da typed message bus + subscription index + debug trace.
- Actor Script Editor/validator tarafinda sozlesme alanlari ve compile uyarilari.
- AI behavior stub'larinin bu yeni API'i kullanacak sekilde guncellenmesi.

Kapsam disi:

- Gorsel node graph / bytecode VM.
- Multiplayer replication.
- Save-game sistemi. Runtime state ayrimi korunur; Play Session state layout'a
  otomatik yazilmaz.

---

## Mevcut Durum Kaniti

- `engine/scene/actorScript.ts`: `ActorScriptDef`, `components[]`,
  `eventBindings[]`, `variables[]`.
- `engine/scene/actorInstance.ts`: placed actor class'i tek entity'ye coker;
  ilk component ve ilk event binding kazanir.
- `engine/behavior/behaviorSubsystem.ts`: `BehaviorContext` su an `actions`,
  `physics`, `audio`, `interactionComponent`, `params`, mutable `transform`
  tasir.
- `src/game/behaviors.ts`: `scriptId -> BehaviorUpdate` registry ve mevcut
  `interact` davranisi.
- `src/core/events.ts`: code-only EventBus var, ancak Actor Script runtime'a
  bagli degil.
- `src/scene/RuntimeSceneApp.ts`: lamba testindeki `toggle-actor-light` gibi
  host-yorumlu aksiyonlar icin gecici ozel baglanti noktasi.

---

## Hedef Mimari

Forge Script Communication System su dort yapi uzerine kurulacak:

1. **ActorRef / EntityRef**
   Belirli bir aktore kontrollu referans: `self`, explicit actor id/nodeId,
   name, tag, classRef, interface veya overlap sonucu.

2. **Message Bus**
   Behavior'lar dogrudan `RuntimeSceneApp` import etmez. Mesajlari
   `context.messages.send(...)` veya `context.messages.emit(...)` ile gonderir.

3. **Interfaces / Capabilities**
   Actor Script sunu ilan edebilir: `interfaces: ["Usable", "Toggleable"]`.
   Baska script'ler sinifa baglanmak yerine bu sozlesmeye mesaj gonderir.

4. **Dispatchers**
   Actor bir olay yayinlar: `Lamp.Toggled`, `Door.Opened`, `Enemy.Died`.
   Dinleyen actor'ler `messageBindings` ile tepki verir.

---

## Veri Modeli Taslagi

```jsonc
{
  "schema": 1,
  "type": "actor",
  "name": "Lamp",
  "interfaces": ["Usable", "Toggleable"],
  "references": [
    { "key": "linkedDoor", "selector": { "byName": "Door_01" } }
  ],
  "dispatchers": [
    { "name": "Lamp.Toggled", "payload": { "enabled": "boolean" } }
  ],
  "eventBindings": [
    {
      "event": "interact",
      "scriptId": "use-toggleable",
      "params": { "inputAction": "interact" }
    }
  ],
  "messageBindings": [
    {
      "message": "Toggleable.Toggle",
      "scriptId": "lamp-toggle"
    }
  ]
}
```

Not: Bu alanlar additive olmali. Eski `*.actor.json` dosyalari normalize edilip
calismaya devam etmeli.

---

## Runtime API Taslagi

Behavior tarafindan hedeflenen sozlesme:

```ts
export interface ScriptMessages {
  send(target: EntityRef, type: string, payload?: Record<string, unknown>): void;
  emit(type: string, payload?: Record<string, unknown>): void;
}

export interface ScriptWorld {
  self(): EntityRef;
  byName(name: string): EntityRef | null;
  byTag(tag: string): EntityRef[];
  withInterface(name: string): EntityRef[];
  nearestWithInterface(name: string, from: EntityRef, maxDistance?: number): EntityRef | null;
}

export interface ScriptState {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  toggle(key: string, fallback?: boolean): boolean;
}
```

`BehaviorContext` hedefi:

```ts
context.messages.send(target, "Toggleable.Toggle", {});
context.messages.emit("Lamp.Toggled", { enabled: true });
context.world.nearestWithInterface("Usable", context.world.self(), 2);
context.state.toggle("enabled");
```

---

## Performans Kurallari

- Event dispatch per-frame global scan yapmamalı; event type + target index'i
  kullanilmali.
- World query'ler tag/interface/component index'lerinden calismali.
- Spatial query ihtiyaci dogarsa physics broad-phase veya cache'li AABB index'i
  kullanilmali.
- Message trace debug icin ring buffer olmali; production'da kapatilabilir.
- Missing handler, missing target, invalid payload gibi durumlar compile/runtime
  warning uretmeli; sessizce yutulmamalı.

---

## AI Kod Uretim Sozlesmesi

AI tarafindan yazilan behavior:

- `RuntimeSceneApp`, Three.js veya DOM import etmez.
- Sadece `BehaviorContext` API'ini kullanir.
- Actor bulmak icin global array taramaz; `context.world` kullanir.
- Baska actor'e direkt component mutate etmez; message/interface kullanir.
- Runtime state'i module-scope map yerine mumkun oldugunca `context.state` icine
  yazar.
- Yeni public action string'i eklerse actor JSON sozlesmesini ve checklist'i
  gunceller.

---

## Checklist

### Faz 0 - Dokuman ve Sozlesme

- [x] `docs/SCRIPT_COMMUNICATION_SYSTEM_CHECKLIST.md` olustur.
- [x] `docs/UNREAL_BASICS_LESSONS.md` Progress Log'a bu mimari fazi kaydet.
- [x] Kanonik dosya listesine yeni checklist'i ekle.
- [x] Actor Script checklist'inde mevcut `EventBus later` kararini bu dokumana
      referanslayacak sekilde guncelle.

### Faz 1 - Saf Runtime Message Core

- [ ] `ScriptMessageEnvelope` tipi:
      `id`, `frame`, `type`, `source`, `target?`, `payload`.
- [ ] `ScriptMessageBus` saf modulu: `send`, `emit`, `subscribe`, `flush`.
- [ ] Event type + target bazli subscription index.
- [ ] Missing target / missing handler / recursive dispatch guard.
- [ ] Headless engine testleri.

### Faz 2 - BehaviorContext Entegrasyonu

- [ ] `BehaviorContext` icine `messages`, `world`, `state` ekle.
- [ ] BehaviorSubsystem lifecycle'inda frame bazli message flush karari ver.
- [ ] `messageBindings` ile behavior tetikleme yolu ekle.
- [ ] Mevcut `interact` behavior'ini host callback yerine message gondermeye
      hazir hale getir.
- [ ] Headless test: actor A mesaj gonderir, actor B behavior'i tetiklenir.

### Faz 3 - Actor Script Schema

- [ ] `ActorScriptDef` alanlari: `interfaces`, `references`, `dispatchers`,
      `messageBindings`.
- [ ] `normalizeActorScriptDef` additive/back-compat parse.
- [ ] `tools/saveValidator.ts` allowlist ve hata mesajlari.
- [ ] `ActorScriptEditor` form yuzeyi: Interfaces, References, Dispatchers,
      Message Bindings.
- [ ] Compile uyarilari: unknown interface/message/script/target.

### Faz 4 - Interaction Genellestirme

- [ ] `Interaction.action` hardcoded host aksiyonlarini azalt.
- [ ] Yakindaki `Usable` actor'e E ile `Usable.Use` mesaji gonder.
- [ ] Lamba testi yeni sistemle yeniden kur:
      `Usable.Use -> Toggleable.Toggle -> light + particle + Lamp.Toggled`.
- [ ] Prompt sistemi `InteractionComponent.prompt` ile kalir, davranis mesajla
      ayrilir.
- [ ] Regression test: Begin overlap prompt, E message, end overlap prompt hide.

### Faz 5 - Direct References ve Query

- [ ] Explicit placed actor/node reference cozumleme.
- [ ] `byName`, `byTag`, `byClassRef`, `withInterface` query'leri.
- [ ] Query cache invalidation: scene load, spawn, destroy.
- [ ] Per-instance override gelmeden once class-level reference sinirlari
      dokumante edilir.

### Faz 6 - Debug ve Tooling

- [ ] Runtime debug panel: son mesajlar, source, target, payload, result.
- [ ] Actor inspect: interfaces, dispatchers, subscribers.
- [ ] Failed message warning'leri.
- [ ] AI behavior stub yorumu yeni API'i anlatacak sekilde guncellenir.

### Faz 7 - Optimizasyon ve Buyuk Proje Gate'i

- [ ] No global per-frame actor scan kuralini test/benchmark ile koru.
- [ ] 1000 actor + 1000 message smoke/perf testi.
- [ ] Production build'de debug trace kapatma/limit ayari.
- [ ] `npm run build:verify` gate'i.

---

## Kabul Kriteri

Bu faz tamamlandiginda:

- Bir actor digerini explicit referansla veya interface uzerinden tetikleyebilir.
- Bir actor event dispatcher gibi olay yayinlayabilir, birden fazla actor
  dinleyebilir.
- AI yazimli behavior'lar RuntimeSceneApp'e ozel kod ekletmeden yeni mekanik
  kurabilir.
- Lamba/switch/door gibi testler hardcoded action `if` bloklari olmadan calisir.
- Debug panel veya trace ile "hangi mesaj kimden kime gitti?" gorulebilir.
