# Ev Ustası — 04 Content

> Durum: taslak | Versiyon: 0.1 | Tarih: 2026-06-12 | Bağımlı: 02-mechanics.md, 03-economy.md, 08-milestones.md

İçerik listeleri. Kapsam etiketi: **[DD]** = dikey dilim, **[MVP]** = tam MVP, **[KES]** = kesilebilir (08-milestones). Oyun içi tüm adlar İngilizce ve tırnak içinde; bu dosya oyun içi metinlerin tek listesidir (ders L10). Sayısal değerler → `balance/parameters.md`. Asset varsayımı (envanterle düzeltildi, Emre onayı 2026-06-12): Kenney Furniture Kit (oda kabukları **ve** mobilya — wall/floor/doorway serisi kitin içinde), Food Kit (mutfak/masa propları). Modular Buildings dış cephe kitidir, iç mekan parçası içermez; yalnız olası dış görünüm/arka plan için not edildi. Envanter: 3DGameDev `docs/2026-06-12-kenney-inventory.md`.

## 1. Mahalleler ve işler (ev/oda tipleri)

| # | Mahalle | Kapsam | Kademe kimliği | İş (oda) tipleri |
| --- | --- | --- | --- | --- |
| 1 | "Maple Street" | [DD] | başlangıç; tek odalı küçük işler | "Studio Flat", "Cozy Bedroom", "Small Kitchen" |
| 2 | "Riverside Lofts" | [MVP] | orta; büyük tek oda / 2 bölge | "Open Loft", "Family Living Room", "Home Office", "Kids Bedroom" |
| 3 | "Hillside Villas" | [MVP, kısmen KES] | üst; geniş oda + bol yüzey | "Villa Lounge", "Master Suite", "Garden Kitchen" |

- İş = oda tipi × müşteri arketipi kombinasyonu; board bu havuzdan üretir (M1). MVP hedefi 12–15 el yapımı oda düzeni (kir/çöp yerleşimi dahil), kombinasyonla çoğalır.
- İçerik kuralı (M2): her odadaki kir decal'leri ve çöpler mevcut kamera açılarından erişilebilir yerleştirilir; sabit demirbaş (tezgâh, radyatör) kiri gizleyemez.
- Her oda tipinin **temel eşya listesi** vardır (teslim asgari koşulu — M6): örn. "Cozy Bedroom" → yatak + ışık kaynağı; "Small Kitchen" → masa + sandalye. Listeler `balance/parameters.md`'de veri olarak tutulur.

## 2. Mobilya kategorileri ve etiketler

Kategoriler (rank ile açılır — M8); kaynak kit parantezde:

| Kategori | Kapsam | Örnek içerik | Çapa tipi (M4) |
| --- | --- | --- | --- |
| "Beds" | [DD] | yatak varyantları (Furniture Kit) | zemin |
| "Sofas & Chairs" | [DD] | koltuk, sandalye, berjer | zemin |
| "Tables & Desks" | [DD] | masa, sehpa, çalışma masası | zemin (+yüzey sunar) |
| "Storage" | [DD] | kitaplık, dolap, raf | zemin / duvar |
| "Lighting" | [MVP] | lambader, masa lambası, aplik | zemin / yüzey / duvar |
| "Rugs" | [MVP] | halılar (üstüne eşya konabilir — alt katman) | zemin (engelsiz) |
| "Wall Decor" | [MVP] | tablo, ayna, saat | duvar |
| "Plants" | [MVP] | saksılar, küçük bitkiler | zemin / yüzey |
| "Kitchen & Table Props" | [MVP, KES adayı] | tabak, fincan, meyve (Food Kit) | yüzey |

Etiket sistemi (M5 puanlamanın dili):

- **Stil etiketleri:** "Cozy", "Modern", "Rustic", "Playful" — her eşyada 1 (nadiren 2).
- **Renk etiketleri:** "Warm", "Cool", "Green", "Neutral" — eşya + swatch'larda. (Kenney modellerinde renk varyantı materyal değişimiyle mi sağlanacak — tech-architect sorusu.)
- Etiketler eşya kartında ikon + sözcük olarak görünür (bilgilendirilmiş alım — M7); müşteri kartındaki ikonlarla birebir aynı dil (eşleştirme gözle yapılır, L9/L12).

## 3. Müşteri arketipleri

Her arketip: portre + 1 stil tercihi + 1 renk tercihi veya quirk + "Hidden Wish" havuzu + 1 nefret etiketi (opsiyonel). Kart metinleri oyun içi metindir:

| Arketip | Kapsam | Görünür tercihler (örnek kart) | Quirk / "Hidden Wish" havuzu örneği | Nefret |
| --- | --- | --- | --- | --- |
| "Grandma Rose" | [DD] | "Loves: Cozy · Warm" | dolly: "a reading chair", "flowers" | "Hates: Clutter" (hafif) |
| "The Bookworm" | [DD] | "Loves: Rustic · a bookshelf" | "a reading lamp" | — |
| "The Minimalist" | [DD] | "Loves: Modern · Neutral" | "a single plant" | "Hates: Clutter" (ağır) |
| "Plant Mom" | [MVP] | "Loves: Green · plants" | "a hanging plant" | — |
| "The Gamer" | [MVP] | "Loves: Playful · a desk" | "an extra monitor", "RGB lamp" | "Hates: Rustic" |
| "The Chef" | [MVP] | "Loves: a big table · Warm" | "fruit bowl", "fancy plates" (Food Kit) | — |
| "Night Owl" | [MVP] | "Loves: Cool · lamps" | "a floor lamp" | — |
| "Cat Person" | [KES] | "Loves: Cozy · soft rugs" | "a cat bed" (özel asset gerekir) | — |

- Arketip × oda eşleşme havuzu kuralları (M1): quirk, odanın kategorileriyle tutarlı seçilir ("The Chef" yalnız mutfak/yemek alanı işlerinde).
- Müşteri karakter modelleri ve emote animasyonları (kalp/onay/surat) Kenney kitlerinin dışında **ek üretim ihtiyacıdır** — twist'in taşıyıcısı olduğu için asset riski yüksek (00-overview açık sorusu; fallback: sabit poz + 2D emote balonu, 08-milestones kesilebilirler).

## 4. Aletler (M7 sink'i)

| Alet | Kapsam | Etki (formüle giriş — 03-economy) | Seviye |
| --- | --- | --- | --- |
| "Big Sponge" | [DD] | sürtme yarıçapı × | 2–3 kademe |
| "Pro Roller" | [MVP] | boyama animasyon süresi ÷ | 2 kademe |
| "Vacuum" | [MVP] | çöpleri tek dokunuşta yakın gruplar hâlinde toplar | 2 kademe |

## 5. Milestone listesi

Ödül biçimi 03-economy (alım gücü endeksli). Banner metinleri oyun içi metindir:

| Milestone | Kapsam | Tetik |
| --- | --- | --- |
| "Sparkling Clean!" | [DD] | ilk odanın temizliği %100 (FTUE, ~ilk dakika) |
| "First Smile!" | [DD] | ilk müşteri kalp tepkisi (~30 sn hedefi) |
| "First Delivery!" | [DD] | ilk iş teslimi |
| "Dream Home!" | [DD] | ilk 3★ teslim |
| "Hidden Wish Found!" | [DD] | ilk gizli dilek keşfi |
| "Street Star!" | [MVP] | "Maple Street" tüm işleri 3★ |
| "Design Apprentice" → "Interior Stylist" → "Master Designer" | [MVP] | rank eşikleri (M8) |
| "Collector" serisi | [MVP] | katalog sahiplik eşikleri (3 kademe) |
| "Loft Legend!", "Villa Virtuoso!" | [MVP/KES] | mahalle 2/3 tüm işleri 3★ |

## 6. Olaylar, teklifler ve UI metinleri

| Olay / öğe | Kapsam | Mekanik | Metinler |
| --- | --- | --- | --- |
| Müşteri selamlaması | [DD] | M1 | "Make it cozy, please!", "I trust your taste!" (arketip başına 2–3 varyant) |
| Faz sekmeleri | [DD] | 01/05 | "Clean", "Paint", "Furnish" |
| Teslim | [DD] | M6 | "Deliver", "Skip", "Before / After", "Total Score", "Tip!" |
| Tepki etiketleri | [DD] | M5 | "Cozy +X", "Color +X", "Bookshelf! +X", "Clutter -X", "Hidden Wish! +X" |
| Gizli dilek | [DD] | M5, R3 | "???", "A hidden wish was left undiscovered…", "Reveal with Ad" |
| Oda dolu | [MVP] | M4 | "Room is full — store something first" |
| Katalog | [DD] | M7 | "Catalog", "Buy", "New!", "Starter Set", "Cozy Set", "Unlocks at Interior Stylist" |
| Rewarded teklifleri | [MVP] | 07 | "Try Premium Set — this job only", "Double Pay", "Magic Vacuum — clean it all", "Fresh Clients" |
| Tekrar | [MVP] | M1 | "Redecorate", "Best: ★★☆" |

## 7. Diegetik tutorial içerikleri

Metin duvarı yok; FTUE araçları (akış 05-ux-ui):

- Yarısı temiz oda + kirli bölgede nabız atan parıltı + parmak işareti (ilk sürtme).
- Hayalet yerleştirmede tek satır ipucu: "Drag the bed anywhere you like!".
- Tek satırlık bağlam ipuçları (toast, her biri bir kez — M9 bayrakları): "Scrub the dirt!", "Tap a swatch, then tap a wall!", "She loved it! Check her card for more wishes.", "Tap her card to see her taste." Toplam benzersiz ipucu ≤ 8.

## 8. Asset ihtiyaç özeti

Ayrıntılı liste ve stil kılavuzu GameDesign deposunda `assets-notes/home-makeover-asset-list.md`'ye çıkarılacak (açık iş); nihai envanter tech-architect + bu depodaki `asset-pipeline` agent'ı ile. Kaba kapsam:

- **Kenney'den (CC0, GLB):** oda kabukları/duvar-zemin modülleri **ve** mobilya (Furniture Kit — düzeltme 2026-06-12: kabuklar bu kitte; Modular Buildings dış cephe kiti, kullanılmıyor), masa/mutfak propları (Food Kit), müşteri karakteri adayı **Blocky Characters v2.0** (emote-yes/emote-no gömülü; stil uyumu H1 render testinde denenecek — Emre kararı 2026-06-12, fallback'ler açık).
- **Ek üretim (kit dışı):** müşteri karakterleri + emote seti (Blocky denemesi tutmazsa kritik), kir decal/çöp varyantları, swatch doku/renk varyantları, UI seti (kartlar, Taste Meter, faz sekmeleri, ikon dili: stil/renk etiketleri), "cat bed" gibi quirk özel eşyaları [KES].
- **SFX:** 06-juice-audio tablosundaki olay listesi; OGG+MP3 çifti. Müzik: 1 hafif loop [MVP].

## Açık sorular

- Kenney Furniture Kit'in stil etiketi çeşitliliğini taşıyıp taşımadığı ("Rustic" ile "Modern" gözle ayrışıyor mu?) — asset envanteri + gerekirse materyal/palet varyantlarıyla ayrıştırma (tech-architect).
- Renk etiketlerinin materyal değişimiyle üretimi (tek model × N palet) teknik olarak ucuz mu? Cevap kataloğun gerçek boyutunu belirler.
- "Rugs" alt katman kuralı (üstüne eşya konabilir) grid sistemini karmaşıklaştırıyor — dikey dilimde prototiple, gerekirse [KES].
- Oda başına kir decal sayısı ve çöp adedi pacing'i (2–4 dk iş hedefi) → `balance/parameters.md`.
- Arketip portreleri 3D model mi 2D illüstrasyon mu? (Kart 2D portre + sahnede 3D karakter ikiliği üretim maliyeti — tech-architect / GameDesign deposunda assets-notes.)
