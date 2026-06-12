# Kenney Kit Envanteri ve Yeterlilik Raporu

> Tarih: 2026-06-12 | Hazırlayan: asset-pipeline | Durum: **tamamlandı — 2 karar Emre'de**
> Kaynak: `gdd/home-makeover/04-content.md` (kategoriler, arketipler, asset ihtiyaç özeti), CLAUDE.md lisans kuralı.
> Ham kitler `tools/raw-assets/` altında (git-ignored); işlenmişler `public/assets/` + `manifest.json`.

## 1. İndirme durumu

Dört kit de kenney.nl'den başarıyla indirildi (tamamı CC0 1.0):

| Kit | Sürüm | İçerik | Zip | İndirme URL'si |
| --- | --- | --- | --- | --- |
| Furniture Kit | 1.0 | 140 GLB (+DAE/FBX/OBJ/STL) | 5,1 MB | `https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip` |
| Modular Buildings | 2.1 | 108 GLB | 1,8 MB | `https://kenney.nl/media/pages/assets/modular-buildings/3253b4219a-1707397411/kenney_modular-buildings.zip` |
| Food Kit | 2.0 | 200 GLB | 4,6 MB | `https://kenney.nl/media/pages/assets/food-kit/83086fa91c-1719418518/kenney_food-kit.zip` |
| **Blocky Characters** (plan dışı, §3) | 2.0 | 18 rigli+animasyonlu GLB | 2,9 MB | `https://kenney.nl/media/pages/assets/blocky-characters/8369c0cf30-1749547469/kenney_blocky-characters_20.zip` |

Yeniden indirme gerekirse hedef klasör: `tools/raw-assets/` (zip + aynı adla açılmış klasör).

## 2. GDD ihtiyaçları × kit içeriği eşlemesi

### 2.1 Kritik bulgu: oda kabuğu Furniture Kit'in içinde; Modular Buildings dış cephe kiti

- **Furniture Kit kendi iç mekan modüllerini içeriyor:** `wall`, `wallCorner`, `wallWindow`, `wallWindowSlide`, `wallHalf`, `wallDoorway(-Wide)`, `floorFull/Half/Corner(-Round)`, `doorway(-Front/-Open)`, `paneling`, `stairs*`. Tek oda + 4 kamera açısı için **yeterli**.
- **Modular Buildings v2.1 tamamen dış cephe kiti** (bina blokları, pencere/çatı/balkon modülleri, örnek evler). GDD 04'teki "oda kabukları için Modular Buildings" varsayımı **yanlış çıktı** — iç mekan parçası yok. Rolü olsa olsa job board/teslim ekranında ev dış görünümü olabilir [KES adayı]; oda kabuğu işini Furniture Kit üstlenir. *GDD 04 §"Asset varsayımı" satırı düzeltilmeli (sessiz düzeltme yapılmadı — işaretlendi).*

### 2.2 Mobilya kategorileri (GDD 04 §2) — Furniture Kit v1.0

| Kategori | Durum | Kit içeriği (örnek) |
| --- | --- | --- |
| "Beds" [DD] | ✅ yeterli | bedSingle, bedDouble, bedBunk, cabinetBed(+Drawer/+Table) |
| "Sofas & Chairs" [DD] | ✅ zengin | 4 sofa (loungeSofa/Corner/Long/Ottoman), loungeChair(+Relax), loungeDesignChair/Sofa, chair ×5 varyant, bench ×3, stoolBar ×2 |
| "Tables & Desks" [DD] | ✅ zengin | table ×9 varyant (round/glass/cloth/cross), tableCoffee ×4, desk, deskCorner, sideTable(+Drawers) |
| "Storage" [DD] | ✅ yeterli | bookcase ×5 (open/closed/wide/low), cabinetTelevision(+Doors), coatRack ×2, kitchenCabinet serisi |
| "Lighting" [MVP] | ✅ tam | lampRound/Square × Floor/Table, lampSquareCeiling, lampWall — GDD'nin üç çapa tipi (zemin/yüzey/duvar) birebir karşılanıyor |
| "Rugs" [MVP] | ✅ yeterli | rugRectangle, rugRound, rugRounded, rugSquare, rugDoormat |
| "Wall Decor" [MVP] | ❌ **boşluk** | yalnız bathroomMirror; tablo/saat/dekoratif ayna YOK → üretim listesinde |
| "Plants" [MVP] | ✅ yeterli | plantSmall1–3, pottedPlant (asılı bitki yok — "Plant Mom" hidden wish'i "a hanging plant" yerine saksı türevine çekilebilir ya da üretilir) |
| "Kitchen & Table Props" [MVP, KES] | ✅ fazlasıyla | Food Kit: plate ×6, bowl ×4, cup/mug, glass-wine, meyve-sebze ~40, fruit bowl kurulabilir; "The Chef" quirk'leri ("fruit bowl", "fancy plates") tamam |

Bonus kapsam: mutfak beyaz eşya serisi (fridge ×4, stove, sink, hood, microwave...), banyo seti (bathtub, shower, toilet, bathroomSink) → "Small Kitchen"/"Garden Kitchen" işleri ve olası banyo oda tipi hazır; elektronik (televisionModern/Vintage, computerScreen, laptop, radio, speaker) → "The Gamer" quirk'leri ("an extra monitor") büyük ölçüde karşılanıyor ("RGB lamp" üretim/materyal varyantı).

### 2.3 Stil/renk etiketi açık sorusu (GDD 04)

- Furniture Kit **tek stil ailesi** — "Rustic" ve "Modern" gözle ayrışmaz; ayrışma model seçimi (loungeDesign* = Modern, tableCloth/chairCushion = Cozy) + **materyal renk varyantı** ile kurulmalı.
- İyi haber: Furniture Kit GLB'leri **texture'sız, adlandırılmış flat materyaller** kullanıyor (`wood`, `metal`, `carpet`, `carpetWhite`...). Tek model × N palet **teknik olarak ucuz** (materyal renk swap; texture üretimi gerekmez) ve instancing/materyal paylaşımına çok uygun. GDD 04 açık sorusuna cevap: **evet, renk etiketi materyal değişimiyle üretilebilir.**
- Dikkat (scene-3d-dev'e): işlenen GLB'lerde `KHR_materials_unlit` extension'ı görünüyor — materyaller unlit ise sahne ışıklandırmasından etkilenmez; H1 render testinde doğrulanıp gerekirse lit'e çevrilmeli.

## 3. Müşteri karakterleri — en kritik soru

**Beklenenin aksine Kenney'de güçlü bir aday VAR: Blocky Characters v2.0** (2025'te tamamen yenilendi). Doğrulanmış içerik (`character-a.glb` inspect):

- 18 karakter varyantı, her biri **rigli + 27 animasyon gömülü**, GLB başına ~111 KB.
- Twist için birebir animasyonlar: **`emote-yes`, `emote-no`** (canlı tepki!), `idle`, `sit`, `walk`, `pick-up`, `interact-left/right`. (Savaş/araç animasyonları kullanılmaz, pipeline'da prune edilir.)
- Maliyet çok düşük: 6 mesh/karakter, 143 vertex, tek 1024² palet texture'ı (256²'ye indirilebilir; tüm karakterler aynı atlas mantığında).

### Seçenekler (karar Emre'de)

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Blocky Characters** | CC0, hazır emote'lar, ~100 KB/karakter, sıfır üretim | **Stil uyumsuzluğu riski:** karakterler köşeli/Minecraft-vari, Furniture Kit yumuşak low-poly — sahnede yan yana test edilmeli (H1/H2'de 10 dk'lık iş) |
| B. Karakter üretimi | Stil tam kontrol | Rig+animasyon üretimi en pahalı asset işi; solo+13 hafta planına en büyük tehdit |
| C. 2D emote balonu fallback (GDD'de hazır) | En ucuz, garanti | Twist'in "canlı müşteri" hissi zayıflar; GDD kesilebilirler listesinde son çare |
| **Önerim: A'yı dene** | Sahne stil testi geçerse B tamamen düşer; geçmezse C zaten hazır. A + C birlikte de çalışır (karakter sahnede, emote balonla güçlendirilmiş). | |

## 4. Eksik asset listesi ("üretilecekler" — güncel hâli, öncelik sıralı)

| # | İhtiyaç | Tür | Kapsam | Not |
| --- | --- | --- | --- | --- |
| 1 | Müşteri karakteri **kararı** (§3) | model/anim | [DD] | Blocky Characters testi kararı bekliyor |
| 2 | Kir decal seti + çöp varyantları | texture/model | [DD] | Kit'lerde yok; decal 2D üretim (ucuz), çöp için cardboardBox*/trashcan kısmen kullanılabilir |
| 3 | UI seti: müşteri kartı, Taste Meter, faz sekmeleri, stil/renk etiket ikonları | 2D | [DD] | Hibrit HTML/CSS — SVG/CSS ağırlıklı üretim |
| 4 | Arketip portreleri (8 adet) | 2D | [DD–MVP] | 3D model ekran görüntüsünden türetilebilir (A seçilirse bedava) |
| 5 | Duvar boya swatch/palet varyantları | materyal | [DD] | Texture değil renk değişimi — neredeyse bedava (§2.3) |
| 6 | "Wall Decor" modelleri: tablo, saat, ayna | model | [MVP] | Tablo = quad + çerçeve, üretimi ucuz; Kenney'de başka kitten devşirme de bakılabilir |
| 7 | SFX seti (GDD 06 tablosu) + 1 müzik loop | ses | [DD–MVP] | OGG+MP3 çifti (L3). Öneri: Kenney **Interface Sounds / Impact Sounds** paketleri (CC0) ilk turda taransın |
| 8 | "a hanging plant" (Plant Mom wish) | model | [MVP] | Yoksa wish havuzundan çıkar |
| 9 | "RGB lamp" (The Gamer) | materyal varyantı | [MVP] | Mevcut lamba + emissive renk |
| 10 | "a cat bed" (Cat Person) | model | [KES] | GDD'de zaten kesilebilir |

## 5. Pipeline durumu (ilk halka — kuruldu)

- `npm run assets:build` → `tools/process-assets.mjs`: dedup → prune → weld → **meshopt** (`EXT_meshopt_compression`) → opsiyonel KTX2 → `public/assets/` + `manifest.json`. Asset listesi/metadata tek yerden: `tools/assets.config.mjs`. Şema dokümanı: `tools/README.md`.
- İlk koşu (render testi seti, 15 GLB: 5 oda kabuğu "core" + 10 mobilya kategori gruplarında): **135,2 KB → 71,9 KB (−%46,8)**. İlk paket < 5 MB bütçesine kıyasla ihmal edilebilir — bütçenin asıl tüketicisi texture/ses/karakter olacak.
- **KTX2 atlandı:** `toktx` (KTX-Software) makinede kurulu değil. Furniture Kit texture'sız olduğundan şu an kayıp yok; Blocky Characters/Food Kit texture'ları girince kurulum anlamlı olur: <https://github.com/KhronosGroup/KTX-Software/releases>
- Runtime gereksinimi (scene-3d-dev'e): GLB'ler meshopt sıkıştırmalı → `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` şart (`meshoptimizer` paketi devDependency olarak mevcut; runtime'a da eklenecek).

## 6. Emre'den istenenler

1. **Karakter kararı (§3):** Blocky Characters stil testi (öneri: H1 render testine 1 karakter eklensin) → A / B / C seçimi.
2. **toktx kurulumu** (opsiyonel, texture'lı asset'ler girmeden gerekmiyor) — kurulursa pipeline otomatik kullanır.
3. GDD 04 düzeltme onayı: "oda kabukları ← Modular Buildings" varsayımı → "oda kabukları ← Furniture Kit; Modular Buildings dış cephe [KES]" (tasarım değişikliği önce GDD'ye kuralı gereği).
