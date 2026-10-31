# 🦃 Kew Companion — tarayıcı uzantısı

Tarayıcıda bir video **izlerken** (YouTube, TikTok, Instagram, X, Facebook, Vimeo, Twitch, Reddit, SoundCloud…) Kew'e haber verir; Kew da "Video algılandı — indirmek için tıkla" bildirimi gösterir. Bildirime tıklayınca indirme otomatik başlar.

**Gizlilik:** Uzantı yalnızca bilgisayarındaki Kew uygulamasına (`127.0.0.1:48155`) konuşur. Hiçbir veri internete gönderilmez, kayıt tutulmaz.

## Kurulum (Chrome / Edge / Brave / Opera)

1. Adres çubuğuna `chrome://extensions` yaz (Edge: `edge://extensions`).
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** düğmesine bas ve bu `browser-extension` klasörünü seç.
4. Bitti — Kew açıkken (veya tepside arka planda çalışırken) video sayfası açtığında bildirim gelir.

## Kurulum (Firefox)

Manifest hem Chrome hem Firefox ile uyumludur, ancak Firefox'un imza kuralları farklıdır:

**Hızlı yol — geçici yükleme** (Firefox her kapanışta uzantıyı kaldırır):
1. Adres çubuğuna `about:debugging#/runtime/this-firefox` yaz.
2. **Geçici Eklenti Yükle** düğmesine bas ve bu klasördeki `manifest.json` dosyasını seç.

**Kalıcı yol** (iki seçenek):
- **İmzalatma (önerilen):** `kew-companion-2.0.0.xpi` dosyasını [addons.mozilla.org](https://addons.mozilla.org/developers/) hesabıyla "kendin dağıt / unlisted" kanalından ücretsiz imzalatıp çıkan imzalı .xpi'yi çift tıklayarak kur.
- **İmza kontrolünü kapatma:** Yalnızca **Firefox ESR / Developer Edition / Nightly** sürümlerinde çalışır — `about:config` → `xpinstall.signatures.required` → `false`, sonra .xpi'yi sürükle-bırak. (Normal Firefox bu ayarı yok sayar.)

## Notlar

- Kew kapalıysa uzantı sessizce hiçbir şey yapmaz.
- Aynı video için 10 dakika içinde tekrar bildirim gösterilmez.
- Kew ayarlarından "Tarayıcı algılama" kapatılırsa bildirimler durur.

**Cybergah Group** · cybergah.com · GPL-3.0
