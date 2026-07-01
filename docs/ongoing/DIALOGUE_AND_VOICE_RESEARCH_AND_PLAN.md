# Diyalog ve Voice Araştırması ve Forge Planı

> Tarih: 2026-06-23 (Faz D1/D2 uygulandı: 2026-07-01, Faz D3: 2026-07-01, Faz D4: 2026-07-01)
> Kapsam: Unreal tarzı author edilmiş diyalog, dialogue voice metadata, altyazı, localization ve Sound Cue Lite ile ilişkisi.
> Durum: Faz D1 (Dialogue Line + subtitle), D2 (Dialogue editörü), D3 (Conversation
> manager) ve D4 (localization + production pipeline) main üzerinde tamamlandı ve
> `build:verify` yeşil (466 test). Kalan tek açık uç: D4 editör yüzeyi (localization
> alanlarını Dialogue Line editöründe düzenleme henüz yok — bkz. D4 devir notları).

## Kısa sonuç

Dialogue and Voice, Sound Cue Lite'tan **ayrı bir Forge çalışma başlığı** olmalıdır.

Sound Cue Lite şu soruya cevap verir: "Sesleri nasıl mixler, varyasyonlu çalar ve temel playback özelliklerini değiştiririz?"

Dialogue/Voice şu soruya cevap verir: "Kim konuşuyor, kim dinliyor, hangi recorded line/subtitle/localized variant çalmalı ve gameplay/conversation akışı nasıl ilerlemeli?"

İki alan playback noktasında kesişir: bir dialogue line, aynı `AudioSubsystem` üzerinden raw `sound`, `soundCue` veya ileride `dialogueWave` source çalabilir. Fakat authoring modeli, localization ihtiyacı, subtitle timing, speaker/listener context ve conversation state farklı olduğu için bunları Sound Cue v1 içine koymak kapsamı gereksiz büyütür.

## Unreal araştırması

### Dialogue Voice ve Dialogue Wave

Unreal spoken dialogue için iki ayrı asset kavramı kullanır:

- `Dialogue Voice`: konuşan voice identity/metadata. Gender ve plurality gibi alanlar tutar; audio dosyası içermez.
- `Dialogue Wave`: tek bir konuşma satırı. Spoken text, subtitle text/override, voice actor direction, mature flag ve birden fazla context mapping taşır.

Ana fikir: aynı metin, speaker/listener context'e göre farklı recorded audio'ya çözülebilir. Dialogue Context, speaker ve target voice'ları eşler; context mapping ise bunu bir Sound Wave'e bağlar.

Kaynaklar:

- https://dev.epicgames.com/documentation/en-us/unreal-engine/audio-system-overview?application_version=4.27
- https://dev.epicgames.com/documentation/en-us/unreal-engine/using-dialogue-voices-and-waves?application_version=4.27
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/DialogueWave?application_version=5.3
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/DialogueContextMapping?application_version=5.0

### Altyazı ve localization

Unreal Dialogue Wave yalnızca audio wrapper değildir. Audio'yu spoken text, subtitle text, translation context ve voice actor notlarıyla bağlar. Unreal dokümanları Dialogue Voice/Wave asset'lerini in-game dialogue event, subtitle ve localization desteği için konumlandırır.

Forge'da da ayrım şöyle olmalı:

- audio file = raw asset;
- dialogue line = text, subtitle, context, metadata, resolved audio;
- conversation = sequence/branching/state logic.

Altyazılar Sound Cue asset içine gömülmemelidir. Sound Cue audio işler; dialogue ise metin ve gameplay context ister.

### Sound Cue ilişkisi

Unreal Sound Cue içinde `Dialogue Player` node'u bulunur. Bu node, belirli speaker/listener context altında bir Dialogue Wave çalar. Fakat daha karmaşık konuşmalar için Sound Cue + Audio Component yanında ayrı conversation manager ihtiyacı vardır; ayrıca basit Sound Cue akışında Dialogue Context'in dinamik değiştirilmesi sınırlıdır.

Forge için sonuç:

- Sound Cue Lite dialogue logic sahibi olmamalı.
- İleride Sound Cue Lite içine `dialogueSource` / `dialoguePlayer` node'u eklenebilir.
- Ana runtime API yine `dialogue.play(lineId, context)` olmalıdır; cue tetikleyip altyazı/conversation state'in eşleşmesini ummak doğru değildir.

Kaynak:
https://dev.epicgames.com/documentation/en-us/unreal-engine/sound-cue-reference?application_version=4.27

### Voice chat ve microphone capture

Unreal'da "voice" canlı voice chat veya microphone capture anlamına da gelebilir:

- EOS Voice Chat, online/multiplayer voice service katmanıdır.
- Audio Capture Component, microphone/audio input tarafıdır; recording veya live input'a yakındır.

Bunlar authored NPC dialogue ile aynı problem değildir. Forge'da multiplayer chat veya recording ihtiyacı doğana kadar Dialogue/Voice authoring track dışında kalmalıdır.

Kaynaklar:

- https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-4.27-release-notes?application_version=4.27
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AudioCaptureComponent?application_version=5.5

## Kapsam kararı

Üç ayrı başlık kullanılmalı:

1. **Sound Cue Lite**
   - Mixing, randomization, pitch/volume modulation, loop, delay, cue preview.
   - Asset: `*.soundcue.json`.

2. **Dialogue and Voice**
   - Dialogue voice kimliği, dialogue line, subtitle text, localization key, voice actor direction, speaker/listener context, conversation playback.
   - Asset: `*.dialoguevoice.json`, `*.dialogue.json` veya `*.dialoguewave.json`, ileride `*.conversation.json`.

3. **Live Voice / Capture**
   - Microphone capture, multiplayer voice chat, recording, WebRTC/media izinleri.
   - Gerçek ürün ihtiyacı gelene kadar kapsam dışı.

## Forge mevcut durum

Forge'da bugün:

- manifest `sound` file desteği var;
- `AudioComponent`, `clipId`, `volume`, `loop`, `spatial`, `autoPlay` taşıyor;
- `AudioSubsystem` ile Web Audio one-shot/file playback var;
- dialogue asset modeli yok;
- subtitle runtime yok;
- localization table yok;
- conversation manager yok;
- audio-finished callback/handle yok;
- microphone capture veya live voice chat katmanı yok.

Bu, Dialogue/Voice'un küçük bir Sound Cue extension'ı gibi ele alınmaması gerektiğini doğrular. Ayrı data/runtime/editor yüzeyi gerekir.

## Önerilen Forge asset modeli

### Dialogue Voice

```ts
type DialogueVoiceAsset = {
  schema: 1;
  type: "dialogueVoice";
  id: string;
  name: string;
  actorId?: string;
  displayName?: string;
  gender?: "neutral" | "feminine" | "masculine";
  plurality?: "singular" | "plural";
  localeHints?: string[];
};
```

Amaç:

- karakter/voice identity;
- localization metadata;
- recorded audio olmadan da kullanılabilir voice referansı.

### Dialogue Line

```ts
type DialogueLineAsset = {
  schema: 1;
  type: "dialogueLine";
  id: string;
  spokenText: string;
  subtitleText?: string;
  voiceActorDirection?: string;
  mature?: boolean;
  contexts: DialogueContextMapping[];
};

type DialogueContextMapping = {
  speakerVoiceId: string;
  targetVoiceIds?: string[];
  locale?: string;
  audioSourceId?: string;
  audioSourceType?: "sound" | "soundCue";
  localizationKey?: string;
};
```

Amaç:

- tek authored line;
- context'e göre birden fazla recorded variant;
- subtitle/translation data line yanında kalır.

### Conversation

```ts
type ConversationAsset = {
  schema: 1;
  type: "conversation";
  id: string;
  nodes: ConversationNode[];
  startNodeId: string;
};

type ConversationNode =
  | { id: string; kind: "line"; lineId: string; speakerVoiceId: string; next?: string }
  | { id: string; kind: "choice"; prompt?: string; choices: { text: string; next: string }[] }
  | { id: string; kind: "event"; eventId: string; next?: string };
```

Amaç:

- sequence, branching, choices ve gameplay event'leri;
- basit bark/tek satır için şart değil, NPC konuşmaları için gereklidir.

## Runtime ihtiyaçları

`AudioSubsystem`'den ayrı bir `DialogueSubsystem` eklenmeli.

Sorumlulukları:

- `lineId + speakerVoiceId + targetVoiceId + locale` ile dialogue line çözmek;
- mapped raw `sound` veya `soundCue` source seçmek;
- playback için `AudioSubsystem` çağırmak;
- subtitle event'lerini runtime UI katmanına göndermek;
- `onLineStart`, `onLineEnd`, `onConversationChoice`, `onConversationEnd` event'leri sağlamak;
- audio eksikken subtitle'ı text length üzerinden estimated duration ile göstermek;
- context resolution ve conversation flow için deterministic headless test sağlamak.

Paralel veya ön koşul audio ihtiyaçları:

- playback handle;
- completion callback;
- decoded buffer metadata üzerinden opsiyonel duration lookup;
- dialogue line source'u `soundCue` olabilecekse cue playback desteği.

## Editor ihtiyaçları

Minimum yararlı editor yüzeyi:

- Content Browser `dialogueVoice`, `dialogueLine` ve ileride `conversation` asset'lerini tanır.
- Dialogue Voice editor: name, actor binding, gender/plurality/localization hints.
- Dialogue Line editor: spoken text, subtitle override, voice actor direction, mature flag, context mappings, linked audio source, preview.
- Conversation editor v1 görsel graph olmadan form/list tabanlı olabilir: line order, speaker, next, choices.
- Validation panel: missing audio, missing subtitle, duplicate localization key, missing speaker voice, source'suz context.

İlk adımda visual conversation graph kurulmamalı. List/tree editor daha hızlı ve test edilebilir.

## Kontrol listesi

### Faz 0 - Araştırma ve kapsam

- [x] Unreal Dialogue Voice / Dialogue Wave ayrımı araştırıldı.
- [x] Dialogue Player node'unun Sound Cue ile ilişkisi incelendi.
- [x] Live voice chat ve microphone capture ayrı kapsam olarak ayrıldı.
- [x] Dialogue/Voice'un Sound Cue Lite altında değil ayrı başlıkta ele alınmasına karar verildi.

### Faz D1 - Dialogue Line ve altyazı dikey kesiti (TAMAMLANDI 2026-07-01)

- [x] `dialogueVoice` asset schema ekle. (`engine/dialogue/dialogueTypes.ts`)
- [x] `dialogueLine` asset schema ekle. (aynı dosya + `DialogueContextMapping`)
- [x] Yeni JSON asset tipleri için manifest recognition ekle.
      (`engine/assets/manifest.ts`: `dialogueVoice`/`dialogueLine` tipleri +
      `.dialoguevoice.json` / `.dialogue.json` uzantıları)
- [x] Loader/validator katmanını ekle. (`engine/dialogue/dialogueResolver.ts`
      pure resolver + `validateDialogueVoice`/`validateDialogueLine`; runtime
      loader `RuntimeSceneApp.loadDialogueAssets`)
- [x] `DialogueSubsystem.playLine(lineId, context)` API'ini ekle.
      (`engine/dialogue/dialogueSubsystem.ts`)
- [x] RuntimeSceneApp içinde subtitle event sink ekle. (`onSubtitleShow` /
      `onSubtitleHide` → overlay)
- [x] Minimal subtitle UI overlay ekle. (`src/scene/subtitleOverlay.ts` +
      `.forge-subtitle` CSS, `#ui-overlay` içinde)
- [x] Text + mevcut audio asset kullanan bir starter line ekle.
      (`DV_Narrator.dialoguevoice.json` + `DL_Welcome.dialogue.json`,
      `starter-snd-ui-confirm` sesine bağlı, manifest'e kayıtlı)
- [x] Missing audio durumunda subtitle'ı estimated duration ile göster.
      (`estimateSubtitleDurationSeconds`, subsystem `update()` zamanlayıcısı)
- [x] Context resolution için headless test ekle. (`tools/engine-tests.ts`
      resolver + subsystem + starter-asset testleri)
- [x] `npm run build:verify` gate'ini geçir. (build + 447 test + verify:dist strict)

**Uygulama notları / D2 için devir:**

- Tetikleyici: `play-dialogue` script mesajı (`payload: { lineId,
  speakerVoiceId?, targetVoiceId?, locale? }`). Runtime bunu `behaviorSubsystem`
  üzerinden dinleyip `dialogueSubsystem.playLine` çağırıyor. Henüz bir editör
  authoring yüzeyi veya oyun-içi emitter yok; script/interaction bu mesajı
  yayınladığında satır oynar.
- Dialogue sesi şu an varsayılan (master) bus'ta çalıyor; ayrı bir "dialogue"
  bus'ı `audioBus.ts`'e eklenirse buradan yönlendirilebilir.
- Subtitle süresi: audio süresi bilinmiyorsa (raw sound handle ve cue süre
  raporlamıyor) metin uzunluğundan tahmin ediliyor. Plandaki opsiyonel "decoded
  buffer duration lookup" D2/sonrası için açık kaldı.
- Save-validator allowlist: D1'de dialogue asset'leri için editör save akışı
  yok, bu yüzden `tools/saveValidator.ts` sidecar allowlist'ine dokunulmadı.
  D2'de Dialogue Voice/Line editörü save eklerken bu allowlist yüzeyi gerekli
  olacak (bkz. CLAUDE.md save-validator gotcha).

### Faz D2 - Dialogue editor (TAMAMLANDI 2026-07-01)

- [x] Dialogue Voice editor ekle. (`src/editor/DialogueEditor.ts` voice modu:
      name/displayName/actorId/gender/plurality/localeHints)
- [x] Dialogue Line editor ekle. (aynı shell, line modu: spoken/subtitle/direction/
      mature + tekrarlanabilir context mapping listesi)
- [x] Raw `sound` ve ileride `soundCue` için audio source picker ekle.
      (context başına audio type + kaynak seçici; hem sound hem soundCue)
- [x] Subtitle preview ile playback preview ekle. (context başına ▶ preview +
      toolbar Preview; subtitle strip + WebAudio playback, cue evaluate)
- [x] Missing audio/subtitle/speaker/localization key uyarılarını ekle.
      (canlı Validation paneli: `validateDialogueVoice/Line` + missing/duplicate uyarıları)
- [x] Save flow ve validation testlerini ekle. (`src/editor/dialogueStore.ts` +
      dev endpoints `/__save-dialogue-voice` / `/__save-dialogue-line`;
      `tools/saveValidator.ts` allowlist + engine-tests testleri)

**Uygulama notları / D3 için devir:**

- Dev endpoint + allowlist: `vite.config.ts` (`PRIVILEGED_URLS`) +
  `tools/saveValidator.ts` (`validateSaveDialogueVoicePayload` /
  `validateSaveDialogueLinePayload` → `validateDialogueVoiceAsset` /
  `validateDialogueLineAsset`). Yeni bir alan eklerken bu allowlist güncellenmeli
  (CLAUDE.md save-validator gotcha).
- Content Browser: `dialogueVoice` / `dialogueLine` yeni-içerik menüsünde;
  çift-tıklama editörü açar. `CONTENT_NEW_KINDS` + stub üretimi
  (`resolveContentNewFile`/`contentStubJson`) eklendi. Line stub'ı boş `contexts`
  ile başlar; editör context ekletir.
- Speaker/target seçici: line editörü voice asset'lerini `voicePaths`'ten yükleyip
  `<datalist>` önerisi sunar, ama serbest-metin id'ye izin verir (kırılmaz).
- Editör hâlâ dinamik `?editor` import'unun arkasında; oyun paketine girmez
  (verify:dist strict yeşil).

### Faz D3 - Conversation manager (TAMAMLANDI 2026-07-01)

- [x] `conversation` asset schema ekle. (`engine/dialogue/conversationTypes.ts`:
      `ConversationAsset` + `isConversationAsset`; manifest `conversation` tipi +
      `.conversation.json` uzantısı)
- [x] Line sequence ve choice node modelini ekle. (`ConversationNode` =
      `line` | `choice` | `event`; line node `targetVoiceId`/`locale` ile resolver
      context'ini besler, event node opsiyonel scalar `payload` taşır)
- [x] Runtime conversation state machine ekle. (`conversationRunner.ts` saf/başsız
      makine: `start`/`advance`/`choose` → `ConversationTransition`; event node'ları
      duraklamadan yürür ve cycle guard ile sonlanır. `validateConversation` yapısal
      doğrulama)
- [x] Existing script/message system üzerinden gameplay event hook'ları ekle.
      (`conversationDirector.ts` → `emitEvent` runtime'da `behaviorSubsystem.
      emitScriptMessage(eventId, "conversation", payload)`; conversation
      `start-conversation` script mesajıyla başlar)
- [x] Basit conversation UI ekle. (`src/scene/conversationOverlay.ts` interaktif
      seçenek paneli + `.forge-conversation` CSS; tıklama veya 1–9 tuşlarıyla seçim;
      satır altyazısı hâlâ `SubtitleOverlay`'de)
- [x] NPC interaction ile conversation başlatma örneği ekle. (`begin-conversation`
      köprü behavior'ı `src/game/behaviors.ts` → NPC'nin `Interaction.Talk` gibi
      olayına Message Binding ile bağlanır ve `start-conversation` yayınlar; starter
      `CONV_Welcome.conversation.json`)
- [x] Conversation flow testleri ekle. (`tools/engine-tests.ts`: runner walk/branch/
      cycle, `validateConversation`, director orchestration/interrupt/stop/replace,
      `begin-conversation` behavior, starter-asset uçtan uca — 459 test yeşil)

**Uygulama notları / D4 için devir:**

- Tetikleyiciler: `play-dialogue` (tek satır bark) ve `start-conversation`
  (`payload: { conversationId }`) script mesajları. Runtime ikisini de
  `behaviorSubsystem.subscribeScriptMessage` ile dinliyor; conversation için
  `ConversationDirector` bir anda tek konuşma çalıştırır.
- Satır ilerletme: `DialogueSubsystem.onLineEnd` → `director.notifyLineEnd`.
  Director yalnızca beklediği satır **doğal** bittiğinde (`interrupted === false`)
  bir sonraki node'a geçer; başka bir bark'ın/başka satırın bitişi veya kesinti
  yok sayılır.
- Event node'ları: fire-and-forget script mesajı olarak `conversation` source id'si
  ile yayınlanır. Payload scalar (`string | number | boolean`) ile sınırlı.
- Save-validator allowlist: D3'te conversation için editör save akışı **yok**
  (görsel/list conversation editörü bilinçli olarak ertelendi — plandaki "Editor
  ihtiyaçları" bölümüne bakınız). Bu yüzden `tools/saveValidator.ts` içine bir
  conversation save-payload doğrulayıcısı eklenmedi; yalnızca `ASSET_TYPE_CATEGORY`'ye
  `conversation: "dialogue"` girişi eklendi. D4/editör conversation save eklerken
  CLAUDE.md save-validator gotcha'sı geçerli olacak.
- Content Browser conversation asset'lerini tanır (badge/label/filter) ama henüz
  bir "yeni conversation" stub'ı veya özel editör açmaz; `.conversation.json`
  şimdilik elle/starter olarak yazılır.

### Faz D4 - Localization ve production pipeline (TAMAMLANDI 2026-07-01)

- [x] Localization key ve per-locale mapping desteği ekle.
      (`resolveDialogueLine(line, context, localization?)` → seçilen context'in
      `localizationKey`'i ile per-locale subtitle + opsiyonel per-locale kayıt
      çözümü. `DialogueLocalizationSource` arayüzü `dialogueResolver.ts`'te;
      `DialogueSubsystem` `localization` option'ı + `setLocalization()` ile taşır.)
- [x] Script/recording sheet için CSV/JSON import/export ekle.
      (`tools/dialoguePipeline.ts`: `buildRecordingSheet` → satır/context başına
      düz satır; `recordingSheetToCsv`/`parseRecordingSheetCsv` RFC4180-vari
      quote/virgül/newline kaçışıyla round-trip; `recordingSheetToJson`/
      `parseRecordingSheetJson`.)
- [x] Missing recording raporu ekle. (`findMissingRecordings` — `audioSourceId`
      atanmamış her context.)
- [x] Voice actor direction export ekle. (`collectVoiceDirections` — direction
      notu olan her satır.)
- [x] Locale bazlı subtitle/audio fallback policy ekle. (Subtitle: localized →
      authored subtitle → spoken text; missing key `undefined` döndürünce authored
      metin kalır — `LocaleRegistry.resolveOptional` bu ayrımı sağlar. Audio:
      per-locale kayıt zaten D1 context scoring'iyle çözülüyor: locale-exact →
      locale-agnostic; ek olarak `resolveAudio` per-locale override kancası var.)
- [x] Build öncesi missing localized asset raporu ekle. (`findMissingLocalizedSubtitles`
      pure fonksiyonu + `tools/dialogueReport.ts` / `tools/dialogue-report.mjs` CLI,
      `npm run dialogue:report [-- --strict]`; manifest'ten dialogueLine + `.loc.json`
      okur, eksik kayıt/localized subtitle/direction raporlar, `--strict` ile CI'da
      fail eder.)

**Uygulama notları / kalan iş:**

- Runtime bağlama: `RuntimeSceneApp` DialogueSubsystem'e canlı bir adapter veriyor
  (`{ resolveSubtitle: (key) => this.localeRegistry?.resolveOptional(key) }`), yani
  bir satırın `localizationKey`'i aktif `.loc.json` locale tablosundan çözülür ve
  locale değişince otomatik güncellenir. `setupDialogue` HUD/menü olmayan sahnede
  bile locale tablolarını yükler (guard). Per-locale **audio** runtime'da context
  mapping'lerle kalıyor; UI loc string tablosunda ses olmadığı için `resolveAudio`
  runtime'da bağlanmadı (sadece resolver-seviyesi kanca + test).
- `.loc.json` sınıflandırması: `engine/assets/manifest.ts` UI_EXTENSIONS'a
  `loc.json` eklendi — artık hem UI hem dialogue localization tabloları manifest'te
  `ui` tipine sınıflanır (`loadUiLocaleRegistry` zaten `.loc.json` süzer). Starter
  `en.loc.json` / `tr.loc.json` (`assets/starter-content/Localization/`) manifest'e
  `loc-en` / `loc-tr` olarak kaydedildi ve `dialogue.welcome` anahtarını çevirir.
- Save-validator: D4 için dialogue-localization editör save akışı **yok**, bu yüzden
  `tools/saveValidator.ts` sidecar allowlist'ine dokunulmadı. `.loc.json` tabloları
  şimdilik elle/starter yazılır. Bir Dialogue Line editörü localization alanlarını
  (veya bir loc-table editörü) save etmeye başlarsa CLAUDE.md save-validator
  gotcha'sı geçerli olacak.
- Kalan iş (editör): Dialogue Line editöründe henüz per-locale subtitle önizleme
  veya loc-table düzenleme yüzeyi yok; pipeline şu an CLI + pure fonksiyonlar
  düzeyinde. D3'te conversation editörü nasıl ertelendiyse, localization editör
  yüzeyi de bilinçli ertelendi.

### Kapsam dışı / ayrı başlık

- [ ] Microphone capture ayrı medya/recording planına taşınacak.
- [ ] Multiplayer voice chat ayrı online/WebRTC planına taşınacak.
- [ ] Procedural TTS ayrı üretim pipeline kararı gerektirir.

## Sound Cue Lite roadmap'i ile ilişki

Önerilen sıra:

1. Acil ihtiyaç SFX/ambience varyasyonuysa Sound Cue Lite Faz 1.
2. Acil ihtiyaç NPC line/subtitle ise Dialogue Faz D1.
3. Sonra köprü: dialogue context mapping, audio source olarak `soundCue` hedefleyebilir.

Dialogue D1 tam Sound Cue editor'a bağlı olmamalı. Dialogue raw `sound` asset'leriyle başlayabilir; cue desteği daha sonra eklenebilir.

## Son karar

**Dialogue and Voice** ayrı bir planned feature alanı olarak ele alınmalı.

Sound Cue Lite'a yakın durur çünkü playback altyapısını paylaşır; ama aynı kapsam değildir. İlk Forge deliverable küçük bir Dialogue Line + Subtitle dikey kesiti olmalı; live voice chat veya full conversation graph olmamalıdır.
