<div align="center">

# 🦃 KEW

**Anonymous · Free · Open** video downloader
for YouTube · TikTok · Instagram · X · Facebook · Vimeo · Reddit · SoundCloud · Twitch & 1000+ sites

*Kew* means **keklik** (the chukar partridge) in Kurdish — a free bird of the mountains.

**by [Cybergah Group](https://cybergah.com) · cybergah.com**

`ku` · `tr` · `ar` · `en` · `fa`

</div>

---

## ⚑ Manifesto — Anonymity & Freedom

> We believe access to information must be **free** and **anonymous**.
> Kew collects **no personal data**, has **no accounts**, **no tracking**, and **no ads**.
> Everything you download stays **on your device**. Forever free, forever yours.
>
> *Cybergah Group — for a free and anonymous internet.*

## 🆕 What's new in v2

- ⚡ **Faster downloads on phones** — yt-dlp self-update no longer blocks the first
  download (it now runs in the background, at most every 12h), fragmented
  streams download with **4 parallel connections** (`--concurrent-fragments 4`),
  and progress events are throttled so the UI stays light during downloads.
- 📂 **Collapsible playlists** — long playlists fold into a single compact card
  (count + overall progress); tap to expand/collapse. Android & Windows.
- 🌐 **More sites detected**: Facebook, Vimeo, Dailymotion, Twitch, Reddit,
  SoundCloud, Pinterest, Rumble, Bilibili — plus every other site yt-dlp supports.
- 🚀 Downloads start instantly with a placeholder card — no more waiting for
  extraction before anything appears.

## ✨ Features

- 📥 Paste a link → download. YouTube, TikTok, Instagram, X, Facebook, Vimeo, Reddit, SoundCloud, Twitch, Dailymotion, Pinterest, Rumble, Bilibili & 1000+ more.
- 🎞️ **Playlists** — download every item at once, shown as a collapsible group.
- 🎵 Video or **audio-only (MP3)**, with quality selection (Max/1080/720/480).
- 📂 Saves straight into the public **`Downloads/Kew`** folder, with a system progress notification (Android `DownloadManager`).
- 🗂️ **Downloads** tab — history of everything you grabbed.
- ▶️ Built-in **player** + open-with-system-player.
- 🌍 **5 languages** with full RTL: Kurdî, Türkçe, العربية, English, فارسی.
- 🎨 React UI, keklik-themed (forest green + gold), animated, glassmorphic.

## 🏗️ Architecture

| Layer | Tech |
|-------|------|
| UI | **React 18 + TypeScript + Vite** — shared with the Windows build (`../shared`) |
| Shell | **Capacitor 6** (Android) |
| Extraction + download | **yt-dlp on the device** ([youtubedl-android](https://github.com/JunkFood02/youtubedl-android)) via the `KewYtdlp` Java plugin — no server, no third party |
| Storage | Capacitor `Preferences` |

### Source layout

```
Kew-v2-kaynak/
├─ shared/          # the whole React UI, used by BOTH Android and Windows
│  ├─ App.tsx       # state + download queue
│  ├─ screens/      # Home, Downloads, About/Settings, Header
│  ├─ components/   # Intro, Player (+ player/), ConfirmDialog
│  └─ lib/          # i18n, platform detection, store, list helpers (+ tests)
├─ kew/             # Android (this folder)
│  └─ src/native.ts # bridge to the Capacitor plugins — imported as "@native"
└─ KEW WINDOWS/     # Windows (Electron)
   └─ src/native.ts # bridge to the Electron main process — "@native"
```

A UI change is made once in `shared/`; each platform only provides its
`native.ts` bridge (same exported functions on both).

## 🔨 Build from source

```bash
npm install
npm test               # unit tests (shared/lib)
npm run typecheck      # TypeScript check
npm run build          # build the React app
npx cap sync android   # copy into the native project
cd android
./gradlew assembleRelease
```

### Release signing

The signing key is **not** part of the source tree. Point the build at it with
environment variables (or the same values as `kew.keystore`,
`kew.keystorePassword`, `kew.keyAlias`, `kew.keyPassword` in
`~/.gradle/gradle.properties`):

```bash
export KEW_KEYSTORE="$HOME/.kew-signing/kew-release.keystore"
export KEW_KEYSTORE_PASSWORD="…"
export KEW_KEY_ALIAS=kew          # optional, default: kew
# export KEW_KEY_PASSWORD="…"     # optional, default: the store password
```

With them set, the signed APK lands in:

```
android/app/build/outputs/apk/release/app-release.apk
```

Without them the build still works and produces an **unsigned**
`app-release-unsigned.apk`.

## 📜 License

**GPL-3.0-or-later.** Free software — use it, study it, share it, improve it.

---

<div align="center">

**Cybergah Group** · [cybergah.com](https://cybergah.com) · info@cybergah.com
© 2026 · Kew v2.0.0

*Free as in freedom.* 🕊️

</div>
