# 🦃 Kew for Windows — v2

Kew'in masaüstü (Windows) sürümü — **Electron** ile, Android sürümüyle **aynı arayüz ve özellikler**.
Çıkarma/indirme işini **yt-dlp.exe + ffmpeg.exe** ile cihaz üzerinde yapar (sunucusuz, anonim).

**Cybergah Group · cybergah.com · GPL-3.0**

## v2 yenilikleri
- ⚡ Daha hızlı indirme: parçalı akışlar 4 paralel bağlantıyla iner (`--concurrent-fragments 4`), ilerleme olayları seyreltildi (arayüz indirme sırasında yorulmaz)
- 📂 Playlist'ler açılır-kapanır grup olarak gösterilir (uzun listeler ekranı kaplamaz)
- 🌐 Yeni algılanan siteler: Facebook, Vimeo, Dailymotion, Twitch, Reddit, SoundCloud, Pinterest, Rumble, Bilibili (+ yt-dlp'nin desteklediği 1000+ site)
- 🔔 **Tarayıcı algılama**: [Kew Companion uzantısı](browser-extension/README.md) kuruluysa, tarayıcıda bir video **izlerken** "Video algılandı — indirmek için tıkla" bildirimi gelir; bildirime tıklayınca indirme otomatik başlar. (Uzantı yalnızca yerel Kew'e `127.0.0.1:48155` üzerinden konuşur — dışarı veri gitmez.) Ayarlardan isteğe bağlı **pano izleme** de açılabilir (kopyalanan linkler).
- 🖥 **Arka planda çalışma**: pencere kapatılınca Kew sistem tepsisine küçülür (çıkış tepsi menüsünden); **Windows ile başlat** açıksa PC açılınca tepside gizli başlar. İkinci kez açılırsa yeni kopya yerine mevcut pencere öne gelir.

## Özellikler (Android ile aynı)
- YouTube · TikTok · Instagram · X · Facebook · Vimeo · Reddit · SoundCloud · Twitch ve 1000+ site + **playlist** (her video ayrı, toplu duraklat/iptal, açılır-kapanır liste)
- Video veya **MP3**, kalite seçimi (Max/1080/720/480)
- Dosyalar **`İndirilenler\Kew`** klasörüne iner
- Dahili oynatıcı + "sistem oynatıcıda aç"
- 5 dil (Kürtçe/Türkçe/Arapça/İngilizce/Farsça, RTL) + giriş animasyonu + keklik sesi
- İndirme bitince bildirim + keklik sesi

## Çalıştırma (geliştirici)
```bash
npm install
npm start          # vite build + electron .
```

## Kurulabilir / taşınabilir sürüm üretme
```bash
npm run dist       # electron-builder ile Windows kurulum + portable .exe
```
Çıktılar `dist-app/` (veya `release/`) altında:
- `Kew-Setup-2.0.0.exe` — kurulum sihirbazı
- `Kew-2.0.0-portable.exe` — kurulumsuz, çift tıkla çalışır

## macOS sürümü (DMG)
Aynı klasörden Apple Silicon (M1/M2/M3…) Mac'ler için imzasız bir DMG üretilir:
```bash
npm run dist:mac   # vite build + electron-builder --mac → release/Kew-2.0.0-mac-arm64.dmg
```
- Mac motorları `resources-mac/` klasöründe: `yt-dlp` (resmi yt-dlp_macos) ve `ffmpeg`
  (ffmpeg-static b6.1.1, GPL — lisansı yanında). İkonlar `tools/make-mac-icons.swift` ile üretilir.
- Uygulama Apple Developer ID ile **imzalı değildir**; `tools/after-pack-mac.cjs` yalnızca
  ad-hoc imza atar. İlk açılışta macOS "doğrulanmamış geliştirici" der:
  **sağ tık → Aç** (veya Sistem Ayarları → Gizlilik ve Güvenlik → "Yine de Aç").
- yt-dlp Mac'te `~/Library/Application Support/Kew/bin/` altına kopyalanıp oradan
  çalışır, böylece uygulama paketine dokunmadan kendini güncelleyebilir.

## Klasör yapısı
```
KEW WINDOWS/
├─ electron/
│  ├─ main.cjs       # ana süreç: pencere + yt-dlp/ffmpeg IPC
│  └─ preload.cjs    # güvenli köprü (window.kew)
├─ src/
│  ├─ main.tsx       # giriş noktası
│  └─ native.ts      # Electron IPC köprüsü ("@native")
├─ resources/
│  ├─ yt-dlp.exe     # indirme motoru (kendini günceller)
│  ├─ ffmpeg.exe     # birleştirme/dönüştürme
│  └─ icon.ico
└─ package.json
../shared/           # React arayüzünün tamamı (Android ile ORTAK — tek kaynak)
```

Arayüz değişiklikleri `../shared/` klasöründe bir kez yapılır; bu klasör yalnızca
Electron köprüsünü (`src/native.ts`) ve ana süreci (`electron/`) içerir.
Testler Android klasöründen çalışır: `cd ../kew && npm test`.

## Notlar
- Ayarlar → yt-dlp bölümünde kurulu sürüm görünür; **Şimdi güncelle** ile elle güncellenebilir.
- `yt-dlp.exe` ilk çalışmada gerekirse kendini günceller (internet ister).
- `ffmpeg.exe` ses+video birleştirme ve MP3 için gereklidir.
- İndirilenler: `C:\Users\<kullanıcı>\Downloads\Kew`

---
**Cybergah Group** · info@cybergah.com · Açık kaynak / Open source · GPL-3.0 · © 2026
