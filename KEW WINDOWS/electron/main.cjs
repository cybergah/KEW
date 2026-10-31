// Kew desktop (Windows + macOS) — Electron main process. Cybergah Group · cybergah.com
const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu, clipboard, nativeImage, globalShortcut, protocol, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn, spawnSync } = require("child_process");
const { pathToFileURL } = require("url");
const { Readable } = require("stream");
const sec = require("./security.cjs");

const IS_MAC = process.platform === "darwin";
const EXE = IS_MAC ? "" : ".exe";

// Downloaded media is served to the renderer through kew-media:// (only files
// inside the user's media folders) instead of turning webSecurity off.
protocol.registerSchemesAsPrivileged([
  { scheme: sec.MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } },
]);

// Engine binaries: resources/ (Windows .exe) or resources-mac/ (macOS) in dev;
// electron-builder copies the right one to <app>/resources in packaged builds.
function findRes() {
  const devDir = path.join(__dirname, "..", IS_MAC ? "resources-mac" : "resources");
  const cands = [
    devDir,                                               // dev + manual package (resources/app/resources)
    path.join(process.resourcesPath || "", "resources"), // electron-builder extraResources
    process.resourcesPath || "",                          // electron-packager extra-resource
  ];
  for (const d of cands) {
    try { if (d && fs.existsSync(path.join(d, "yt-dlp" + EXE))) return d; } catch {}
  }
  return devDir;
}
const RES = findRes();
const FFMPEG = path.join(RES, "ffmpeg" + EXE);
const ICON = path.join(RES, IS_MAC ? "icon.icns" : "icon.ico");
const TRAY_ICON = path.join(RES, IS_MAC ? "tray.png" : "icon.ico");

// macOS: yt-dlp must stay updatable (`-U`), but rewriting a binary inside the
// .app bundle would break the bundle's signature. Run a copy from the user's
// Application Support folder instead, seeded from the bundled one.
function macYtdlp() {
  const bundled = path.join(RES, "yt-dlp");
  try {
    const dir = path.join(app.getPath("userData"), "bin");
    const copy = path.join(dir, "yt-dlp");
    if (!fs.existsSync(copy) || fs.statSync(copy).size === 0) {
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(bundled, copy);
      fs.chmodSync(copy, 0o755);
      // the copy inherits the DMG's quarantine flag, which would block it
      spawnSync("xattr", ["-d", "com.apple.quarantine", copy]);
    }
    return copy;
  } catch {
    return bundled;
  }
}
const YTDLP = IS_MAC ? macYtdlp() : path.join(RES, "yt-dlp.exe");

// Windows shows toast notifications only when the app's AppUserModelID matches
// the Start Menu shortcut's (set by the installer to the appId). Without this
// line packaged builds silently drop every Notification.
if (!IS_MAC) app.setAppUserModelId("com.cybergah.kew");

const children = new Map();

let win = null;
let tray = null;
let quitting = false;

// Desktop prefs — the renderer pushes the saved settings (and translated
// labels) right after boot and whenever they change.
const prefs = {
  watchBrowser: true,   // browser extension reports the tab you are watching
  watchClipboard: true, // copied links — works without any extension (Firefox!)
  autoStart: true,
  labels: {
    show: "Kew'i göster",
    quit: "Çıkış",
  },
};

// The save folder is chosen only through the native folder dialog below and
// kept here in the main process — the renderer can never hand it a path.
const CONFIG = () => path.join(app.getPath("userData"), "kew-config.json");
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG(), "utf8")) || {}; } catch { return {}; }
}
function writeConfig(c) {
  try { fs.writeFileSync(CONFIG(), JSON.stringify(c)); } catch {}
}
function defaultDir() {
  const d = path.join(app.getPath("downloads"), "Kew");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function customDir() {
  const d = readConfig().saveDir;
  try { return d && fs.statSync(d).isDirectory() ? d : null; } catch { return null; }
}
function downloadsDir() {
  return customDir() || defaultDir();
}

/** The only folders the player, library and "open" may touch: Downloads/Kew
 *  and the save folder the user picked. The rest of the disk stays off-limits. */
function mediaRoots() {
  const roots = [];
  try { roots.push(defaultDir()); } catch {}
  const c = customDir();
  if (c && !roots.includes(c)) roots.push(c);
  return roots;
}

// kew-media://media/<encoded path> → the file, with Range support for seeking.
function serveMedia(req) {
  const fp = sec.resolveAllowed(req.url, mediaRoots(), sec.PLAYABLE_EXT);
  if (!fp) return new Response("not found", { status: 404 });
  const size = fs.statSync(fp).size;
  const headers = { "Content-Type": sec.mimeOf(fp), "Accept-Ranges": "bytes" };
  const range = sec.parseRange(req.headers.get("range"), size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  const { start, end } = range || { start: 0, end: size - 1 };
  const body = size === 0 ? null : Readable.toWeb(fs.createReadStream(fp, { start, end }));
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      "Content-Length": String(size === 0 ? 0 : end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}

function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  // Windows blocks focus-stealing from background apps, so a plain show()
  // leaves Kew behind the browser. Flash always-on-top to jump in front,
  // then release it so the window doesn't stay pinned.
  try {
    if (IS_MAC) app.focus({ steal: true });
    win.setAlwaysOnTop(true, "screen-saver");
    win.moveTop();
    win.focus();
    setTimeout(() => {
      try { win.setAlwaysOnTop(false); } catch {}
    }, 1000);
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    // square window on desktop (the Android build keeps the phone aspect)
    width: 820,
    height: 820,
    minWidth: 520,
    minHeight: 520,
    backgroundColor: "#0d2c19",
    icon: ICON,
    autoHideMenuBar: true,
    title: "Kew",
    // a login launch starts hidden in the tray / menu bar
    show: !(process.argv.includes("--hidden") || (IS_MAC && app.getLoginItemSettings().wasOpenedAtLogin)),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required",
      // music keeps playing (and the sleep timer keeps counting) while the
      // window is closed to the tray / menu bar
      backgroundThrottling: false,
    },
  });
  // A link dropped on the window must not navigate away from the app; the
  // renderer picks it up as a download instead.
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.removeMenu();
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  // Closing the window keeps Kew alive in the tray; quit is in the tray menu.
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function buildTray() {
  if (!tray) {
    tray = new Tray(nativeImage.createFromPath(TRAY_ICON)); // tray.png picks up tray@2x.png on Retina
    tray.setToolTip("Kew — Cybergah Group");
    tray.on("click", showWin);
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: prefs.labels.show, click: showWin },
      { type: "separator" },
      { label: prefs.labels.quit, click: () => { quitting = true; app.quit(); } },
    ])
  );
}

// ---- video detection → "download?" notification -------------------------
// Two sources feed offerDownload():
//   1. The Kew Companion browser extension: while you WATCH a video, it POSTs
//      the tab's URL to http://127.0.0.1:48155/video (local only — nothing
//      leaves the machine).
//   2. Optional clipboard fallback (off by default): a copied video link.
const VIDEO_HOSTS = [
  "youtube.com", "youtu.be", "youtube-nocookie.com",
  "twitter.com", "x.com", "t.co",
  "tiktok.com", "vm.tiktok.com",
  "instagram.com", "instagr.am",
  "facebook.com", "fb.watch", "fb.com",
  "vimeo.com", "dailymotion.com", "dai.ly",
  "twitch.tv", "reddit.com", "redd.it",
  "soundcloud.com", "pinterest.com", "pin.it",
  "rumble.com", "bilibili.com", "b23.tv",
];
const DETECT_PORT = 48155;
const OFFER_COOLDOWN_MS = 10 * 60 * 1000; // don't re-offer the same video for 10 min

function videoHostOf(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return VIDEO_HOSTS.some((d) => host === d || host.endsWith("." + d)) ? u.toString() : null;
  } catch {
    return null;
  }
}

const offered = new Map(); // url -> last offer timestamp

// A detected video pops the in-app confirmation dialog directly (Windows
// toasts can't carry a download button) — nothing downloads until the user
// presses the download button there. `force` (right-click "Download with Kew")
// accepts ANY http(s) URL: yt-dlp will try, and a clear "can't download from
// this site" error shows if it can't.
function anyHttpUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function offerDownload(rawUrl, _pageTitle, force) {
  if (!win) return;
  const url = force ? anyHttpUrl(rawUrl) : videoHostOf(rawUrl);
  if (!url) return;
  const now = Date.now();
  if (now - (offered.get(url) || 0) < OFFER_COOLDOWN_MS) return;
  if (offered.size > 500) offered.clear();
  offered.set(url, now);
  win.webContents.send("kew:detected-url", url);
  showWin();
}

// Keep yt-dlp.exe fresh: sites change their formats often, so run its
// self-updater in the background (never blocks a download) at most once
// every 12h. Silently a no-op if the install dir isn't writable.
function kickYtdlpUpdate() {
  try {
    const marker = path.join(app.getPath("userData"), "ytdlp-last-update");
    let last = 0;
    try { last = fs.statSync(marker).mtimeMs; } catch {}
    if (Date.now() - last < 12 * 60 * 60 * 1000) return;
    try { fs.writeFileSync(marker, String(Date.now())); } catch {}
    const p = spawn(YTDLP, ["-U"], { windowsHide: true });
    p.on("error", () => {});
  } catch {}
}

// Run yt-dlp with plain-text output (version / self-update), with a timeout.
function runText(args, timeoutMs) {
  return new Promise((resolve) => {
    let out = "";
    let p;
    try { p = spawn(YTDLP, args, { windowsHide: true }); } catch { return resolve({ code: -1, out: "" }); }
    const timer = setTimeout(() => { try { p.kill(); } catch {} }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", () => {});
    p.on("close", (code) => { clearTimeout(timer); resolve({ code, out: out.trim() }); });
  });
}

// Settings → "yt-dlp version" + manual "update now".
ipcMain.handle("kew:engineVersion", async () => {
  const r = await runText(["--version"], 15000);
  return r.code === 0 ? r.out.split(/\r?\n/)[0] : null;
});

ipcMain.handle("kew:engineUpdate", async () => {
  const r = await runText(["-U"], 120000);
  try { fs.writeFileSync(path.join(app.getPath("userData"), "ytdlp-last-update"), String(Date.now())); } catch {}
  const v = await runText(["--version"], 15000);
  return { ok: r.code === 0, version: v.code === 0 ? v.out.split(/\r?\n/)[0] : undefined };
});

// Tiny localhost listener for the Kew Companion browser extension.
function startDetectServer() {
  const srv = http.createServer((req, res) => {
    // Only the Kew Companion extension may use this: web pages (any http(s)
    // or "null" origin) and DNS-rebinding hosts are refused.
    const origin = req.headers.origin;
    if (!sec.isLoopbackHost(req.headers.host, DETECT_PORT) || !sec.isAllowedOrigin(origin)) {
      res.writeHead(403);
      return res.end();
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Private-Network", "true"); // Chrome PNA preflight
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    if (req.method !== "POST" || req.url !== "/video") { res.writeHead(404); return res.end(); }
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 4096) req.destroy();
    });
    req.on("end", () => {
      try {
        const j = JSON.parse(body || "{}");
        // force=true comes from the extension's right-click menu — an explicit
        // user action, so it bypasses both the toggle and the host filter.
        if (j.force) offerDownload(j.url, j.title, true);
        else if (prefs.watchBrowser) offerDownload(j.url, j.title, false);
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
    });
  });
  srv.on("error", () => {}); // port taken → another Kew instance owns it
  srv.listen(DETECT_PORT, "127.0.0.1");
}

// Clipboard fallback (opt-in).
let lastClip = "";

function clipTick() {
  if (!prefs.watchClipboard || !win) return;
  let txt = "";
  try { txt = (clipboard.readText() || "").trim(); } catch { return; }
  if (!txt || txt === lastClip) return;
  lastClip = txt;
  if (txt.length > 500 || /\s/.test(txt)) return;
  offerDownload(txt, "");
}

// Only one Kew at a time — a second launch just brings the window back.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWin);

  app.whenReady().then(() => {
    protocol.handle(sec.MEDIA_SCHEME, serveMedia);
    createWindow();
    buildTray();
    startDetectServer();
    kickYtdlpUpdate();
    // Global shortcut: Ctrl+Shift+K → offer the clipboard link for download
    // (any site — same confirmation dialog as detection).
    try {
      globalShortcut.register("Control+Shift+K", () => {
        let txt = "";
        try { txt = (clipboard.readText() || "").trim(); } catch {}
        if (txt && !/\s/.test(txt)) offerDownload(txt, "", true);
      });
    } catch {}
    setInterval(clipTick, 1200);
    try { lastClip = (clipboard.readText() || "").trim(); } catch {}
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWin();
    });
  });
}

app.on("before-quit", () => { quitting = true; });
app.on("will-quit", () => { try { globalShortcut.unregisterAll(); } catch {} });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---- desktop prefs from the renderer (clipboard watch, autostart, labels) ----
ipcMain.handle("kew:prefs", (_e, p) => {
  if (p && typeof p === "object") {
    if (typeof p.watchBrowser === "boolean") prefs.watchBrowser = p.watchBrowser;
    if (typeof p.watchClipboard === "boolean") prefs.watchClipboard = p.watchClipboard;
    if (typeof p.autoStart === "boolean") prefs.autoStart = p.autoStart;
    if (p.labels && typeof p.labels === "object") Object.assign(prefs.labels, p.labels);
  }
  buildTray();
  // Register/unregister "start at login" (hidden in the tray / menu bar).
  // Skipped in dev where process.execPath is the bare Electron binary.
  if (app.isPackaged) {
    try {
      if (IS_MAC) app.setLoginItemSettings({ openAtLogin: prefs.autoStart });
      else app.setLoginItemSettings({ openAtLogin: prefs.autoStart, path: process.execPath, args: ["--hidden"] });
    } catch {}
  }
  return true;
});

function runJson(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(YTDLP, args, { windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0 && !out) return reject(new Error((err || "yt-dlp error").trim().slice(-300)));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error("parse: " + e.message)); }
    });
  });
}

// ---- metadata / preview ----
// Every yt-dlp target is a validated http(s) URL placed after "--", so it can
// never be parsed as an option (e.g. "--exec ...").
function targetUrl(raw) {
  const u = sec.httpUrl(raw);
  if (!u) throw new Error("invalid url");
  return u;
}

ipcMain.handle("kew:info", async (_e, url) => {
  const j = await runJson(["--no-warnings", "--no-playlist", "--dump-single-json", "--", targetUrl(url)]);
  return {
    title: j.title || j.fulltitle,
    thumbnail: j.thumbnail,
    duration: j.duration,
    uploader: j.uploader,
    extractor: j.extractor,
    ...sec.qualitiesOf(j),
  };
});

// ---- playlist enumeration ----
ipcMain.handle("kew:playlist", async (_e, url) => {
  const root = await runJson(["--no-warnings", "--flat-playlist", "-J", "--", targetUrl(url)]);
  const toEntry = (en) => {
    let eurl = en.webpage_url || en.url || "";
    const id = en.id || "";
    if (!String(eurl).startsWith("http") && id) {
      const k = (en.ie_key || root.extractor_key || "").toLowerCase();
      eurl = k.includes("youtube") ? "https://www.youtube.com/watch?v=" + id : id;
    }
    let thumb = en.thumbnail;
    if (!thumb && Array.isArray(en.thumbnails) && en.thumbnails.length) thumb = en.thumbnails[en.thumbnails.length - 1].url;
    if (!thumb && id && String(id).length === 11) thumb = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    return { url: eurl, title: en.title || eurl, thumbnail: thumb };
  };
  if (Array.isArray(root.entries)) return { entries: root.entries.filter(Boolean).map(toEntry), title: root.title };
  return { entries: [toEntry(root)] };
});

// ---- search by name (YouTube via yt-dlp's ytsearch, flat = fast) ----
ipcMain.handle("kew:search", async (_e, query, limit, source) => {
  const target = sec.searchTarget(query, limit, source);
  if (!target) return [];
  const root = await runJson(["--no-warnings", "--flat-playlist", "-J", "--", target]);
  const sc = source === "sc";
  return (root.entries || []).filter((en) => en && en.id).map((en) => {
    let thumb = sc ? undefined : "https://i.ytimg.com/vi/" + en.id + "/hqdefault.jpg";
    if (sc && Array.isArray(en.thumbnails)) {
      const t = en.thumbnails.find((x) => x.id === "t300x300") || en.thumbnails[en.thumbnails.length - 1];
      thumb = t && t.url;
    }
    return {
      url: en.url && String(en.url).startsWith("http") ? en.url : "https://www.youtube.com/watch?v=" + en.id,
      title: en.title || en.id,
      thumbnail: thumb,
      duration: typeof en.duration === "number" ? Math.round(en.duration) : undefined,
      uploader: en.channel || en.uploader || undefined,
    };
  });
});

// ---- download (with live progress) ----
// Tags for music apps: artist from the uploader, overridden by an
// "Artist - Title" video title; "(Official Video)"-style suffixes dropped.
const TAG_ARGS = [
  "--embed-metadata",
  "--parse-metadata", "%(artist,creator,uploader,channel)s:%(meta_artist)s",
  "--parse-metadata", "title:%(meta_artist)s - %(meta_title)s",
  "--replace-in-metadata", "meta_title,title",
  "(?i)\\s*[\\(\\[][^\\)\\]]*(official|lyric|audio|video|visuali[sz]er|hd|hq|4k)[^\\)\\]]*[\\)\\]]", "",
];
ipcMain.handle("kew:download", (e, opts) => {
  return new Promise((resolve, reject) => {
    const target = sec.httpUrl(opts && opts.url);
    if (!target) return reject(new Error("invalid url"));
    const dir = downloadsDir();
    const start = Date.now() - 2000;
    const clip = sec.clipSpec(opts.clip);
    const args = [
      "-o", path.join(dir, clip ? "%(title).80B [%(id)s] %(section_start)d-%(section_end)ds.%(ext)s" : "%(title).80B [%(id)s].%(ext)s"),
      "--no-mtime", "--no-playlist", "--continue", "--restrict-filenames", "--newline",
      "--concurrent-fragments", "8", // parallel fragment download (YouTube DASH/HLS)
      "--socket-timeout", "15", "--retries", "5", "--fragment-retries", "5",
      "--ffmpeg-location", FFMPEG,
    ];
    if (opts.audioOnly) {
      // m4a/opus prefer a matching source stream so ffmpeg just remuxes
      // (no re-encode); mp3 always re-encodes.
      const af = opts.audioFormat === "mp3" || opts.audioFormat === "opus" ? opts.audioFormat : "m4a";
      if (af === "mp3") args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
      else if (af === "opus") args.push("-f", "ba[ext=webm]/ba/b", "-x", "--audio-format", "opus");
      else args.push("-f", "ba[ext=m4a]/ba/b", "-x", "--audio-format", "m4a");
      // cover art + tags, so music apps show the song properly
      args.push("--embed-thumbnail", "--convert-thumbnails", "jpg", ...TAG_ARGS);
    }
    else {
      args.push("-f", "bv*+ba/b", "-S",
        opts.quality === "max" ? "res,vcodec:h264,ext:mp4" : "res:" + opts.quality + ",vcodec:h264,ext:mp4",
        "--merge-output-format", "mp4");
      // Optional subtitles: keep the .vtt next to the video (in-app player
      // renders it) AND embed a copy into the mp4 (for VLC & co.).
      if (opts.subLang) args.push("--sub-langs", opts.subLang + ".*", "--write-subs", "--write-auto-subs", "--embed-subs");
      args.push("--embed-thumbnail", ...TAG_ARGS);
    }
    // only the chosen part (cut on exact frames, so the clip starts where asked)
    if (clip) args.push("--download-sections", clip, "--force-keyframes-at-cuts");
    args.push("--", target);

    const child = spawn(YTDLP, args, { windowsHide: true });
    children.set(opts.taskId, child);
    let err = "";
    // Throttle progress IPC: yt-dlp prints many lines per second and each one
    // used to trigger a renderer re-render. Send at most ~4/s (100% always).
    let lastSent = 0;
    child.stdout.on("data", (d) => {
      const s = d.toString();
      const m = s.match(/\[download\]\s+([\d.]+)%/);
      if (!m) return;
      const pct = parseFloat(m[1]);
      const now = Date.now();
      if (pct < 100 && now - lastSent < 250) return;
      lastSent = now;
      e.sender.send("kew:progress", { taskId: opts.taskId, progress: pct, line: s.trim().slice(0, 200) });
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (er) => { children.delete(opts.taskId); reject(er); });
    child.on("close", (code) => {
      const killed = child.killed;
      children.delete(opts.taskId);
      if (killed) return reject(new Error("cancelled"));
      let files = [];
      try {
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f); const st = fs.statSync(fp);
          if (st.isFile() && st.mtimeMs >= start && !/\.(part|ytdl|tmp)$/i.test(f))
            files.push({ name: f, path: fp, uri: pathToFileURL(fp).href, mime: /\.(mp3|m4a|opus|wav|aac)$/i.test(f) ? "audio/*" : "video/*" });
        }
      } catch {}
      if (code !== 0 && files.length === 0)
        return reject(new Error((err.replace(/\s+/g, " ").trim() || "yt-dlp failed").slice(-300)));
      if (files.length > 0 && opts.notify) showDone(opts.title);
      resolve({ files });
    });
  });
});

ipcMain.handle("kew:cancel", (_e, taskId) => {
  const c = children.get(taskId);
  if (c) { try { c.kill(); } catch {} }
  return true;
});

// Open a downloaded file in the system player — only audio/video files inside
// the media folders, so the renderer can never launch an .exe or script.
ipcMain.handle("kew:openPath", async (_e, p) => {
  const fp = sec.resolveAllowed(p, mediaRoots(), sec.MEDIA_EXT);
  if (!fp) return false;
  await shell.openPath(fp);
  return true;
});

// ---- save folder (desktop): picked with the native dialog only ----
ipcMain.handle("kew:getFolder", () => ({ path: downloadsDir(), custom: !!customDir() }));
ipcMain.handle("kew:chooseFolder", async () => {
  const r = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"], defaultPath: downloadsDir() });
  if (!r.canceled && r.filePaths[0]) writeConfig({ ...readConfig(), saveDir: r.filePaths[0] });
  return { path: downloadsDir(), custom: !!customDir() };
});
ipcMain.handle("kew:resetFolder", () => {
  const c = readConfig();
  delete c.saveDir;
  writeConfig(c);
  return { path: downloadsDir(), custom: false };
});

// Reveal a downloaded file in Explorer; with no path, open Downloads\Kew.
ipcMain.handle("kew:showInFolder", (_e, p) => {
  const fp = sec.resolveAllowed(p, mediaRoots(), sec.PLAYABLE_EXT);
  try {
    if (fp) shell.showItemInFolder(fp);
    else shell.openPath(downloadsDir());
  } catch {}
  return true;
});

ipcMain.handle("kew:notify", (_e, title) => { showDone(title); return true; });

// ---- media library: scan Kew's download folder for the player tab ----
const MEDIA_VIDEO_RE = /\.(mp4|mkv|webm|mov|avi|m4v)$/i;
const MEDIA_AUDIO_RE = /\.(mp3|m4a|opus|ogg|wav|flac|aac)$/i;

ipcMain.handle("kew:listMedia", (_e, type) => {
  const re = type === "audio" ? MEDIA_AUDIO_RE : MEDIA_VIDEO_RE;
  const roots = mediaRoots();
  const out = [];
  const seen = new Set();
  const walk = (dir, depth) => {
    if (depth > 3 || out.length >= 2000) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const en of ents) {
      if (out.length >= 2000) return;
      const fp = path.join(dir, en.name);
      if (en.isDirectory()) {
        if (!en.name.startsWith(".") && en.name !== "node_modules") walk(fp, depth + 1);
      } else if (re.test(en.name) && !seen.has(fp)) {
        seen.add(fp);
        let st;
        try { st = fs.statSync(fp); } catch { continue; }
        out.push({
          title: en.name.replace(/\.[a-z0-9]+$/i, ""),
          name: en.name,
          path: fp,
          duration: 0,
          mtime: st.mtimeMs,
        });
      }
    }
  };
  for (const r of roots) walk(r, 0);
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, 1500);
});

function showDone(title) {
  try {
    if (Notification.isSupported())
      new Notification({ title: "Kew ✓", body: title || "İndirme tamamlandı", icon: ICON, silent: false }).show();
  } catch {}
}
