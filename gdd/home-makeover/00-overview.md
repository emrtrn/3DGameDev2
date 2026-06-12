# Ev Ustası (home-makeover) — 00 Overview

> Durum: taslak | Versiyon: 0.1 | Tarih: 2026-06-12 | Bağımlı: GameDesign deposu (`c:\Users\emret\Desktop\GameDesign`) concepts/backlog.md (#2)

## 1. Vizyon

Boş veya dağınık bir low-poly evi temizleyip boyayıp döşeyen, işin sonunda **müşterinin beğenisiyle ödüllendirilen** bir renovasyon/dekorasyon oyunu. House Flipper'ın "kirliyi pırıl pırıl yapma" tatmini × Sims yapı modunun "kendi zevkinle döşeme" özgürlüğü — ama casual ölçekte: tek oda/ev, kısa işler, anında geri bildirim.

Tek cümlelik deneyim hedefi (Lens #1 Essential Experience, Schell 1. baskı, kitap s. 21 / PDF s. 51): **"Kiri silip parlatmanın fiziksel tatmini ve birinin evini tam kalbinden dekore etmenin gururu."**

Özgün twist (Lens #2 Surprise, #4 Curiosity) — klon değil kuralının cevabı:

- **Müşteri sahnede ve canlı:** House Flipper'da puanlama sessiz bir bilançodur; burada müşteri odanın kapısında **işini izler** ve her yerleştirmeye anında tepki verir (kalp / onay / surat asma + nedeni yazan puan etiketi). Puanlamanın nedeni hiçbir zaman gizli değildir (ders L9).
- **Okunabilir zevk profili + "Hidden Wish":** Her müşterinin iş kartında 2 görünür tercihi (stil + renk/quirk) ve 1 gizli dileği ("?") vardır. Gizli dilek doğru eşyayla keşfedilince bonusla açılır — merak döngüsü ve adil bir rewarded ipucu yeri (07-monetization R3).
- Dekorasyon türünün çoğu mobil örneği (Redecor vb.) hazır şablonlar arasında seçim yaptırır; burada oyuncu **gerçekten yerleştirir** — 3D sahnede tek parmakla.

## 2. Hedef kitle ve platform

- **Kitle:** Poki global casual oyuncusu; makeover/dekorasyon ve "satisfying cleaning" içerik sevenler (Power Wash, House Flipper, ASMR temizlik videoları kitlesi). Yaş çekirdeği 9–17, ikincil 18–34; tür kadın oyuncu payı yüksek. Okuma yükü minimum; tüm oyun içi metin İngilizce ve kısa.
- **Platform:** HTML5, Poki (iframe). **Mobile-first tek parmak**; masaüstünde fare ile birebir aynı akış.
- **Teknoloji varsayımı:** **3D** (stüdyonun ilk 3D projesi). Motor: **Three.js** (`three@0.184.0` pinli) — tech-architect karşılaştırması sonucu, Emre onayıyla kesinleşti (2026-06-12; gerekçe ve karar tablosu: 3DGameDev `docs/2026-06-12-engine-decision.md`). Backlog'un Babylon eğilimi analizde doğrulanmadı. Asset temeli: **Kenney low-poly CC0 GLB/GLTF kitleri** (Modular Buildings + Furniture Kit + Food Kit); eksik kalan modeller, görseller ve sesler ayrıca üretilecek (ayrıntılı envanter `asset-pipeline` agent'ı + tech-architect). Kod geliştirme bu depoda (`C:\Users\emret\Desktop\3DGameDev`) yürütülür; Claude agent'lı 3D geliştirme sistemi kuruldu (2026-06-12, bkz. kök CLAUDE.md), proje iskeleti motor kararıyla gelecek (08-milestones H1).
- **Oturum modeli:** Hesap yok, dış link yok. Kayıt localStorage (sürümlenmiş JSON). Oturum birimi = "iş" (job): 2–4 dakikalık tek ev teslimi kendi başına tatmin etmeli (paylaşılan cihaz gerçeği — ders L7).

## 3. Poki çıtası ile hizalama

| Poki çıtası | Ev Ustası cevabı | Doğrulayan bölüm |
| --- | --- | --- |
| 3 sn anlaşılır / 8 sn ilk ödül / 30 sn bağlanma | Menüsüz açılış: **yarısı temiz, yarısı kirli oda** (görev kendini anlatır); ilk sürtmede kir silinir + parıltı (~5. sn); 30. sn'de ilk teslim kutlaması | 05-ux-ui (FTUE) |
| Mobile-first tek dokunuş | Faz sekmeleri sayesinde tek parmak hep tek anlam taşır: Clean'de sürt, Furnish'te sürükle; kamera 90° adım butonuyla döner | 05-ux-ui |
| Hızlı yük | İlk iş tek oda + küçük GLB paketi; mahalle/kit asset'leri lazy-load (3D'de kritik — ders L8) | tech-architect'e devredildi |
| Reklam = opt-in rewarded | 5 rewarded yerleşim; `commercialBreak` yalnız ev teslimi sonrası doğal durakta | 07-monetization |
| Hesap yok, oturum tek başına tatmin | localStorage + 2–4 dk'lık tamamlanan iş birimi | 02-mechanics M6, M9 |
| Juice şart | Sürtme = gerçek zamanlı kir silme + partikül; her yerleşime pop + müşteri tepkisi + puan uçuşması | 06-juice-audio |
| Klon değil | Canlı müşteri tepkisi + "Hidden Wish" keşif döngüsü | 01-core-loop, 02-mechanics M5 |

## 4. Başarı ölçütleri

- İlk anlamlı etkileşim (ilk kir sürtmesi) **< 5 sn**; ilk görünür ödül (silme + parıltı + metre dolması) **< 8 sn**.
- İlk iş teslimi (ödeme + yıldız) **ilk 3 dakika içinde** — balance hedefi → `balance/parameters.md`.
- Ortalama oturum ≥ 8 dk (≈ 2–3 iş); 1. gün dönüş oranı Poki dekorasyon/simülasyon medyanının üzeri (medyan `market-analyst` raporuyla netleşecek).
- "Hidden Wish" keşif oranı: işlerin anlamlı bir bölümünde oyuncu gizli dileği reklamsız keşfedebilmeli (merak döngüsü çalışıyor göstergesi; eşik playtest'te).
- Rewarded izlenme: oturum başına ≥ 1 gönüllü izleme.
- Teslim sekansını atlama (skip) oranı düşük kalmalı — kutlama sıkıyorsa kısaltılır (playtest metriği).

## 5. Önceki projeden taşınan dersler (uyarlama)

Kaynak: GameDesign deposunda `gdd/power-city/00-overview.md` bölüm 5 (L1–L12, Şehir Enerji Mühendisi postmortem'inden). Bu projeye uyarlananlar:

- **L2 — Efekt koddan:** Kir silme maskesi, parıltı, toz, konfeti — hepsi koddan (shader/partikül); GLB modeller temiz kalır. 3D'de bu ilke asset bütçesini ikiye katlar değerde (06-juice-audio).
- **L3 — Merkezi ses sistemi:** Kanal ayrımı (master/music/sfx/ui), OGG+MP3 çifti, eksik dosya boot'u bloklamaz. Aynen taşınır (06-juice-audio).
- **L4 + L10 — Veri/metin tek kaynak:** Eşya/müşteri/iş tanımları data modüllerinde; oyun içi metinlerin tek listesi 04-content; sayıların tek kaynağı `balance/parameters.md`.
- **L6 — Mobil sonradan eklenmez:** 3D'de bu risk 2D'den büyük (kamera + sürükleme + dokunma hedefleri). Tüm yerleştirme UX'i önce dik telefonda tasarlandı (05-ux-ui); masaüstü uyarlamadır.
- **L7 — Paylaşılan cihaz/localStorage:** Tek iş kendi başına keyifli; kayıt kaybı FTUE'yi yeniden keyifli kılmalı.
- **L8 — Asset şişmesi (3D'de kritik):** GLB'ler tek seferde preload edilmez; ilk iş minimal paketle açılır, mobilya kategorileri ve mahalleler lazy-load + mesh sıkıştırma (tech-architect bütçeleyecek). Bu proje için L8, en yüksek riskli teknik derstir.
- **L9 — Neden-sonuç görünürlüğü:** "Neden bu puanı aldım?" sorusu asla cevapsız kalmaz: her puan değişimi **etiketiyle** uçar ("Cozy +12", "Clutter -8"), müşteri tepkisi kaynağın üstünde belirir, Taste Meter kategori segmentli (05-ux-ui). Twist'in kendisi bu dersin mekanikleşmiş hâlidir.
- **L11 — Modüler sistem sınırları:** Her mekanik (02-mechanics M1–M9) bağımsız test edilebilir sistem sınırı; 3DGameDev'deki agent sistemi modül planını buradan türetir.
- **L12 — Görsel zenginlik okunabilirliği yememeli:** 3D sahnede "neresi kirli / nereye koyabilirim?" anında okunmalı: kir decal'leri belirgin dil + kalan kir sayacı; geçerli yerleşim yeşil/geçersiz kırmızı hayalet (05-ux-ui).
- (L1 ve L5 enerji oyununa özgüdür; karşılıkları burada "müşteri tepkisi = görünür neden-sonuç" ve "her eylem puana yazar" ilkeleridir.)

## 6. Kapsam özeti

- **Dikey dilim:** 1 mahalle ("Maple Street"), 3 tek odalı iş, tam döngü (temizle→boya→döşe→teslim), 3 müşteri arketipi, canlı tepki + "Hidden Wish", save.
- **Tam MVP (solo, ~3 ay):** 2(–3) mahalle, 12–15 iş, 8–9 mobilya kategorisi, 6–8 müşteri arketipi, "Design Rank" ilerlemesi, 5 rewarded yerleşim, sürümlenmiş save.
- Haftalık plan ve kesilebilirler: 08-milestones.

## Açık sorular

- **Süreçten sapma:** Bu oyun için one-pager konsept yazılmadı, `market-analyst` doygunluk taraması ve `design-critic` gate'i **yapılmadı** — backlog maddesinden doğrudan GDD'ye geçildi (Emre kararı, 2026-06-12). GDD bu yüzden bütünüyle `taslak`; her iki kapı da bu GDD üzerinde koşulacak ve twist/kapsamı değiştirebilir.
- ~~**Three.js vs Babylon.js** → `tech-architect` kararı.~~ **Çözüldü (2026-06-12): Three.js.** Dört kriter (GLB pipeline, mobil performans, paket boyutu, agent destekli geliştirilebilirlik) üzerinden karşılaştırıldı; karar notu 3DGameDev `docs/2026-06-12-engine-decision.md`.
- **"Ev Ustası" Türkçe çalışma adıdır;** İngilizce yayın adı araştırması (Poki arama görünürlüğü dahil) yapılmadı. Klasör çalışma adı: `home-makeover`.
- **Power City ile takvim çakışması:** Bu proje sırada ikinci; başlangıç tarihi Emre'nin kararına bağlı (08-milestones tarihsiz, H1–H13 göreli hafta planı).
- ~~**Kenney kitlerinin kapsama yeterliliği doğrulanmadı.**~~ **Büyük ölçüde çözüldü (2026-06-12, asset-pipeline envanteri — 3DGameDev `docs/2026-06-12-kenney-inventory.md`):** 9 kategoriden 8'i yeterli; oda kabukları Furniture Kit'te (Modular Buildings dış cephe kiti çıktı, GDD 04 düzeltildi — Emre onayı). **Müşteri karakterleri için aday bulundu:** Blocky Characters v2.0 (rigli, emote-yes/emote-no gömülü, CC0) — stil uyumu H1 render testinde denenecek (Emre kararı: dene; tutmazsa üretim veya 2D balon fallback). Kalan boşluklar: Wall Decor modelleri, kir decal'leri, UI seti (kit dışı üretim listesi envanter raporunda önceliklendirildi).
- Birincil oryantasyon dik (portrait) varsayıldı (stüdyo standardı); 3D oda kadrajının dik ekranda doğrulanması → tech-architect + erken prototip.
