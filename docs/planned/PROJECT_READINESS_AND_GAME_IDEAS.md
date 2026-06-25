# Proje Hazırlık Değerlendirmesi ve Oyun Tasarım Fikirleri

> Tarih: 2026-06-25
> Durum: Değerlendirme / planlama. Kod uygulanmadı.
> Amaç: `docs/ongoing` işleri (Sound Cue Lite + Dialogue/Voice) tamamlandığı
> varsayımıyla, Forge'un Kenney asset'leriyle basit web oyunları üretmeye hazır
> olup olmadığını değerlendirmek, eksikleri sıralamak ve ilk oyun fikirlerini
> dokümante etmek.

## Kısa cevap

**Platform tarafı (engine + editör) olgun ve sağlam; basit web oyunları için
teknik altyapı hazır.** Ama "oyun yapmaya başlamak" için eksik olan şey bir
**editör özelliği değil** — eksik olan ince bir **oynanış çerçevesi katmanı**
(skor, kazan/kaybet, tur akışı) ve **web erişimi için input genişliği**
(dokunmatik/gamepad). Bunlar `docs/ongoing` ve `docs/planned`'da görünmüyor;
yani şu an kör nokta.

Doğru ifade: **bir tech-demo / sandbox olarak hazırız, ama bir _oyun_ göndermek
için 2–3 küçük temel parça daha gerekiyor.** İyi haber: bunlar küçük ve
`src/game/` içine oturur (engine'e dokunmaz).

## Sağlam olan (kanıtlı)

Bu değerlendirme sırasında doğrulandı: `tsc --noEmit` hatasız, **374 engine
testi** geçiyor, üretim derlemesi (`dist/`) çalışıyor ve editör oyun bundle'ından
dışlanmış (dynamic `?editor` import).

| Alan | Durum | Kanıt |
|---|---|---|
| Mimari sınırlar | engine/editor/builder/game ayrımı net, headless-test edilebilir saf çekirdek | ~58k satır TS, 374 test |
| Editör | gizmo, outliner, details, content browser, undo/redo, snapping, World Settings | `src/editor/` |
| Oynanış çekirdeği (G1–G6) | hareket, yerçekimi/zıplama, çarpışma yanıtı, TPS takip kamerası, locomotion animasyonu, oynanabilir örnek sahne — hepsi `[x]` | `docs/architecture/UNREAL_BASICS_LESSONS.md` |
| Karakter sistemi | Pawn + CharacterMovement + PlayerController + PlayerCameraManager (spring arm, FOV, shake), possession akışı | `src/game/gameModes/` |
| Actor Script + iletişim | component modeli, message/interface/dispatcher | `docs/completed/SCRIPT_COMMUNICATION_SYSTEM_CHECKLIST.md` |
| Skeletal toolset (Persona-lite) | blend space, anim set, montage, layered upper-body blend, notify, ragdoll (runtime + editör simulate) | `src/editor/SkeletalMeshEditor.ts` |
| Materyal + çarpışma editörü | form-tabanlı material, ORM/layer blend; collision preset, complexAsSimple, KDOP | `src/editor/MaterialEditor.ts`, `StaticMeshEditor.ts` |
| Ortam | Sky Atmosphere, Height Fog, Clouds, Post Process, Sphere Reflection Capture | `docs/completed/` |
| UI (UMG Lite) | RuntimeUiSubsystem, screen stack, focus/nav, binding (ViewModel), localization, a11y/ARIA, tema, world-space widget | `src/ui/`, `engine/ui/` |
| Fizik / FX | Rapier (lazy yüklenen ~2.2MB chunk) + AABB fallback; particle effect sistemi | `engine/render-three/particleEffect.ts` |
| Asset kütüphanesi | 140+ Kenney GLB, 167 staticMesh, 74 texture, 17 material, 20 ses | `public/assets/manifest.json` |

Bu, "bir karakter düzlemde kayıyor" seviyesinin çok ötesinde. Unreal'dan
**araçları değil ayrımları** kopyalama disiplini tutarlı uygulanmış.

## Kritik eksikler (gerçek oyun göndermeden önce)

Üçü de kod taramasıyla doğrulandı; gerçekten yoklar.

### 1. Oynanış çerçevesi yok (skor / kazan-kaybet / tur akışı / pause) — en büyük boşluk

`score`, `lives`, `gameOver`, `objective`, `checkpoint`, `pause` için tüm arama
sonuçları yalnızca yorum satırlarında çıkıyor ("game content *lives* here") —
gerçek bir sistem yok. `GameMode` sadece *possession/spawn* yapıyor, oyun
*kuralları* değil. Bir collectathon bile şunu ister: hedef sayacı, kazanma
koşulu, "tekrar oyna", duraklat.

**Çözüm yeri `src/game/`** — küçük, saf, test edilebilir bir `GameState`/rules
katmanı + UMG Lite HUD binding. Engine'e veya editöre dokunmaz.

### 2. Dokunmatik / gamepad input yok — web erişimi için kritik

`engine/input/` + `src/input/` yalnızca klavye ve pointer-look (fare) içeriyor.
`gamepad` sadece bir yorumda geçiyor, `touch` hiç yok. Web oyunları sıkça
mobil/dokunmatik oynanır; sanal joystick + dokunmatik buton katmanı olmadan
itch.io/mobil tarayıcı kitlesi kaybedilir. Mevcut action-map mimarisine yeni bir
input *source* olarak temiz oturur.

### 3. Ses oynatma handle'ı yok — müzik/loop durdurulamıyor

`engine/audio/audioSubsystem.ts` içindeki tek `stop()` built-in osilatöre ait;
dosya playback'i için durdurma/fade yok. Yani arka plan müziği başlatılıp
durdurulamıyor, `spatial` saklanıyor ama uygulanmıyor. Sound Cue planı bunu Faz
2'ye koymuş, ama bu **Sound Cue'dan bağımsız, daha temel bir ihtiyaç** — en basit
oyun bile menü/arka plan müziği ister. Playback handle'ı Sound Cue'nun arkasına
saklamayıp öne çekmek gerekir.

> Not: `docs/ongoing` (Sound Cue Lite + Dialogue/Voice) doğru kapsanmış ve doğru
> sıralanmış planlar. Tek düzeltme: playback handle önceliklendirmesi.

## İkincil eksikler (engelleyici değil, ama erken lazım olur)

- **Proje scaffold'u yok** (`tools/create-project.mjs` — backlog B2). Her oyun =
  template kopyası olacaksa, ilk oyundan önce olmasa da ikinciden önce gerekli.
  Şu an manuel kopya/temizleme riskli.
- **Save/persistence (oyun ilerlemesi)** — mimari "Layout Data ≠ Save Game Data"
  diyor ama save-game sistemi yok. localStorage tabanlı küçük bir katman çoğu
  basit oyunda istenir.
- **Asset çeşitliliği dar** — 140 model ağırlıklı *mobilya/iç mekan*, ve yalnızca
  **1 karakter** (`character-a`). Mevcut kütüphane esasen "iç mekan
  keşif/collectathon"a uygun. Platformer/araç/arena için ek Kenney kit'leri
  (Platformer Kit, Mini Characters, Car Kit, Blaster Kit) gerekir.
- **İlk yük bütçesi** — three (~750KB) + oyun (~226KB) ≈ ~1MB ham (gzip'le çok
  düşer); Rapier ~2.2MB doğru şekilde lazy. Fizik gerektirmeyen hafif oyunlar
  için iyi; ama bunu ölçmek (`dist-report.json`, backlog B3) faydalı.

## Önerilen sıra

1. **Ses playback handle + temel müzik/loop kontrolü** — Sound Cue'dan önce,
   küçük. (Mevcut ongoing planın Faz 2 maddesini öne çek.)
2. **Sound Cue Lite + Dialogue** — zaten planlı; sıra korunur.
3. **Minimal Game Framework katmanı** (`src/game/`): `GameState`
   (skor/can/hedef), kazan-kaybet, restart, pause + UMG Lite HUD binding. İlk
   oyun bunu zaten gerektireceği için "ilk oyunu yaparken çıkar" en verimlisi.
4. **Dokunmatik + gamepad input source** — action map'e yeni source; mevcut
   mimariye temiz oturur.
5. **`create-project.mjs` scaffold** — ikinci oyundan önce.

**Pratik formül:** Sound bittikten sonra "tek bir küçük gerçek oyunu" uçtan uca
yapın (Kenney mobilya seti + `character-a` ile bir iç-mekan collectathon). O
oyun, eksik #1/#3'ü ve scaffold ihtiyacını doğal olarak ortaya çıkarır ve
genelleştirilebilir parçaları `src/game/` çekirdeğine geri besler. Soyut olarak
"framework" yazmaktan daha sağlıklı.

## Oyun tasarım fikirleri (mevcut asset'lerle)

Eldeki kütüphane (iç mekan mobilya + TPS karakter + fizik + ragdoll + çarpışma +
ortam) şu fikirlere doğrudan uyuyor.

### 1. "Çıkış" / İç-Mekan Collectathon — en iyi uyum, ilk oyun adayı

Odalardan eşya topla, hedefe ulaş, süreyle yarış. Her şey hazır: TPS karakter,
çarpışma, takip kamerası, trigger (mevcut sensor-collider kalıbı). Eksik #1'i
(skor/timer/win) ve #3'ü (toplama sesi/müzik) doğal olarak test eder.

- Çekirdek döngü: keşfet → topla → hedefe ulaş → süre/skor.
- Hedef asset: mevcut mobilya/iç-mekan seti + `character-a` (yeterli).
- Gereken yeni sistem: Game Framework (skor/timer/win), ses handle.
- İlk dikey kesit: tek oda, 3 toplanabilir, bir çıkış trigger'ı, HUD sayaç.

### 2. Fizik "Devir" / Kaos odası

Ragdoll + Rapier zaten var; eşyaları devir, hedef puana ulaş. Mevcut fizik
yatırımını sergiler.

- Hedef asset: mevcut mobilya (devrilebilir prop'lar).
- Gereken yeni sistem: skor + dinamik (simulate) prop yerleştirme; ses handle.

### 3. Saklambaç / Hafif stealth

Odalarda görüş/ses tabanlı kaçış; AABB collision + audio (handle gelince) ile.

- Gereken yeni sistem: basit AI/algılama, Game Framework (yakalanma=kaybet).

### 4. Teslimat / Sıralama

İç mekanda eşyayı doğru yere taşı; basit ama "objective" sistemini zorlar.

- Gereken yeni sistem: taşıma/etkileşim (mevcut `interaction.ts` üstüne),
  objective takibi.

> Daha çeşitli türler (platformer, araç, arena-shooter) için ek Kenney kit'leri
> indirip manifest'e eklemek gerekir — mevcut set bunlar için yetersiz.

## Sonraki adım

İlk oyun olarak **#1 (İç-Mekan Collectathon)** önerilir: mevcut asset'lere birebir
uyar ve eksik #1/#3 ile scaffold ihtiyacını minimum riskle açığa çıkarır. Bu
fikir bir oyun tasarım dokümanına (çekirdek döngü, asset listesi, gereken
sistemler, dikey kesit) genişletilebilir.
