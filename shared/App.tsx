import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CirclePlay, Download, House, Settings as SettingsIcon } from "lucide-react";
import { KewLogo } from "./assets/Logo";
import { Intro } from "./components/Intro";
import { PlayerScreen } from "./components/Player";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DupeDialog } from "./components/DupeDialog";
import { Header, TabBtn } from "./screens/Header";
import { HomeScreen, type DownloadRequest } from "./screens/Home";
import { DownloadsScreen } from "./screens/Downloads";
import { AboutScreen } from "./screens/About";
import { makeT, isRTL } from "./lib/i18n";
import { isValidUrl } from "./lib/platform";
import { setSfxEnabled, sfx } from "./lib/sfx";
import { downloadedKeys, findDownloaded } from "./lib/media";
import { ytdlpDownload, ytdlpPlaylist, ytdlpCancel, ytdlpSetBusy, ytdlpPlayKeklik, onYtdlpProgress, openFile, isNative, browserDownload, toPlayableSrc, showInFolder, consumeShare, setDesktopPrefs, onDetectedUrl } from "@native";
import {
  loadSettings,
  saveSettings,
  loadDownloads,
  saveDownloads,
  createSaver,
  newId,
  type Settings,
  type DownloadRecord,
  DEFAULT_SETTINGS,
} from "./lib/store";

type Tab = "home" | "downloads" | "player" | "about";
const TAB_ORDER: Tab[] = ["home", "downloads", "player", "about"];

type TaskMeta = { url: string; audioOnly: boolean; quality: string; title: string; audioFormat?: string; subLang?: string; clip?: { start: string; end: string } };

/** Rebuild a task from its saved record (e.g. resuming after an app restart). */
function metaFromRecord(d: DownloadRecord, s: Settings): TaskMeta {
  return {
    url: d.url,
    audioOnly: d.audioOnly,
    quality: d.quality || s.quality,
    title: d.title,
    audioFormat: d.audioFormat,
    subLang: d.subLang,
    clip: d.clip,
  };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [playing, setPlaying] = useState<DownloadRecord | null>(null);
  const [toast, setToast] = useState<string>("");
  const [kbOpen, setKbOpen] = useState(false);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [dupe, setDupe] = useState<{ req: DownloadRequest; rec: DownloadRecord } | null>(null);
  const [dragging, setDragging] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // download queue (one yt-dlp process at a time, so each item finishes & saves on its own)
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef<Set<string>>(new Set());
  const intentRef = useRef<Record<string, "pause" | "cancel">>({});
  const metaRef = useRef<Record<string, TaskMeta>>({});
  const attemptsRef = useRef<Record<string, number>>({});
  const settingsRef = useRef<Settings>(settings);
  const downloadsRef = useRef<DownloadRecord[]>(downloads);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  downloadsRef.current = downloads;

  const t = useMemo(() => makeT(settings.lang), [settings.lang]);

  // boot
  useEffect(() => {
    (async () => {
      const [s, d] = await Promise.all([loadSettings(), loadDownloads()]);
      setSettings(s);
      setDownloads(d);
      setReady(true);
      // keklik call on launch, timed to the notes the intro bird sings
      if (s.sound) window.setTimeout(() => ytdlpPlayKeklik(), 1850);
    })();
    // The intro dismisses itself (~3.6s); this is only a safety net.
    const timer = window.setTimeout(() => setIntro(false), 5500);
    return () => window.clearTimeout(timer);
  }, []);

  // apply language direction
  useEffect(() => {
    document.documentElement.lang = settings.lang;
    document.documentElement.dir = isRTL(settings.lang) ? "rtl" : "ltr";
  }, [settings.lang]);

  // hide the bottom tab bar while a text field is focused (keyboard open)
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    const onIn = (e: FocusEvent) => isField(e.target) && setKbOpen(true);
    const onOut = (e: FocusEvent) => isField(e.target) && setKbOpen(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  // Persist downloads, debounced: progress updates arrive several times a
  // second and used to rewrite the whole history on every tick. Flush right
  // away when the app is backgrounded or closed.
  const saver = useMemo(() => createSaver(saveDownloads), []);
  useEffect(() => {
    if (ready) saver.schedule(downloads);
  }, [downloads, ready]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "hidden") saver.flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", saver.flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", saver.flush);
    };
  }, []);

  // live progress from the native yt-dlp engine
  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => void } | undefined;
    onYtdlpProgress((e) => {
      setDownloads((list) =>
        list.map((d) =>
          d.id === e.taskId
            ? { ...d, progress: e.progress, statusLine: e.line }
            : d
        )
      );
    }).then((h) => (handle = h));
    return () => handle?.remove();
  }, []);

  // Push desktop prefs (tray labels, browser/clipboard watch, autostart) to
  // the main process — on boot and whenever the language/toggles change.
  // No-op on Android.
  useEffect(() => {
    if (!ready) return;
    setDesktopPrefs({
      watchBrowser: settings.watchBrowser,
      watchClipboard: settings.watchClipboard,
      autoStart: settings.autoStart,
      labels: {
        show: t("tray_show"),
        quit: t("tray_quit"),
      },
    });
  }, [ready, settings.watchBrowser, settings.watchClipboard, settings.autoStart, settings.lang]);

  // Links from outside the app ask for confirmation first — nothing downloads
  // until the user presses the download button.
  //   desktop: the user clicked a "video detected" notification
  useEffect(() => onDetectedUrl((url) => setConfirmUrl(url)), []);
  //   Android: "Share → Kew" from another app
  useEffect(() => {
    if (!isNative()) return;
    const check = () => consumeShare().then((u) => { if (u) setConfirmUrl(u); });
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => setSfxEnabled(settings.uiSounds), [settings.uiSounds]);

  // One delegated listener gives every control its sound; actions with their
  // own sound (download start, search, errors) play it where they happen.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("button, .toggle, .chip");
      if (!el || (el as HTMLButtonElement).disabled || el.classList.contains("btn-gold")) return;
      if (el.classList.contains("tab")) { if (!el.classList.contains("on")) sfx.tab(); }
      else if (el.classList.contains("toggle")) (el.classList.contains("on") ? sfx.toggleOff : sfx.toggleOn)();
      else if (!el.classList.contains("danger")) sfx.tap();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  function flash(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  function patchSettings(p: Partial<Settings>) {
    setSettings((s) => {
      const ns = { ...s, ...p };
      saveSettings(ns);
      return ns;
    });
  }

  const MAX_RETRY = 3;

  function finishOk(id: string, files: { name: string; uri: string; path: string }[]) {
    attemptsRef.current[id] = 0;
    // Subtitle files don't get their own list entry — they attach to their video.
    const isSub = (n: string) => /\.(srt|vtt|ass|lrc)$/i.test(n);
    const subFiles = files.filter((f) => isSub(f.name));
    const media = files.filter((f) => !isSub(f.name));
    if (media.length === 0) {
      failOrRetry(id);
      return;
    }
    const subFor = (name: string) => {
      const base = name.replace(/\.[a-z0-9]+$/i, "");
      const s = subFiles.find((x) => x.name.startsWith(base));
      return s ? toPlayableSrc(s.path) : undefined;
    };
    setDownloads((list) => {
      const base = list.find((d) => d.id === id);
      if (!base) return list;
      const recs: DownloadRecord[] = media.map((f, i) => ({
        ...base,
        id: i === 0 ? id : newId(),
        filename: f.name,
        title: media.length === 1 && base.title ? base.title : f.name.replace(/\.[a-z0-9]+$/i, ""),
        status: "completed",
        progress: 100,
        localUri: f.uri,
        playUri: toPlayableSrc(f.path),
        subUri: subFor(f.name),
      }));
      return list.flatMap((d) => (d.id === id ? recs : [d]));
    });
    delete metaRef.current[id];
    if (!settingsRef.current.sound) sfx.success(); // otherwise the keklik call plays
    // completion sound + notification are fired natively in the download thread
    // (works in the background too) — see KewYtdlpPlugin / electron/main.cjs.
  }

  // A failed/empty item is retried automatically a few times before giving up.
  function failOrRetry(id: string, err?: string) {
    const a = (attemptsRef.current[id] || 0) + 1;
    attemptsRef.current[id] = a;
    if (a < MAX_RETRY) {
      setDownloads((list) => list.map((d) => (d.id === id ? { ...d, status: "queued", progress: -1, statusLine: `retry ${a}/${MAX_RETRY}` } : d)));
      queueRef.current.unshift(id); // retry this one before moving on
    } else {
      const msg = (err || "").replace(/\s+/g, " ").trim().slice(0, 180);
      setDownloads((list) => list.map((d) => (d.id === id ? { ...d, status: "failed", statusLine: msg || undefined } : d)));
      sfx.error();
    }
  }

  // Process the queue: run up to `concurrent` (1-3) downloads at once.
  function pump() {
    const max = Math.max(1, Math.min(3, settingsRef.current.concurrent || 1));
    while (runningRef.current.size < max && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      let meta = metaRef.current[next];
      if (!meta) {
        // Not started in this session (restored from history) — rebuild it.
        const rec = downloadsRef.current.find((d) => d.id === next);
        if (!rec) continue;
        meta = metaRef.current[next] = metaFromRecord(rec, settingsRef.current);
      }
      runningRef.current.add(next);
      startTask(next, meta);
    }
    if (runningRef.current.size === 0) ytdlpSetBusy(false);
  }

  function startTask(next: string, meta: TaskMeta) {
    const title = (meta.title || "").slice(0, 40);
    const n = runningRef.current.size;
    ytdlpSetBusy(true, n > 1 ? `↧ ${n}` : title ? `↧ ${title}` : "Kew");
    setDownloads((list) => list.map((d) => (d.id === next ? { ...d, status: "running", progress: -1 } : d)));

    ytdlpDownload({
      url: meta.url,
      audioOnly: meta.audioOnly,
      audioFormat: meta.audioFormat || settingsRef.current.audioFormat,
      subLang: meta.subLang,
      quality: meta.quality,
      clip: meta.clip,
      taskId: next,
      title: meta.title,
      notify: settingsRef.current.notify,
      sound: settingsRef.current.sound,
    })
      .then((res) => {
        const files = res.files || [];
        if (files.length === 0) failOrRetry(next);
        else finishOk(next, files);
      })
      .catch((e: any) => {
        const intent = intentRef.current[next];
        delete intentRef.current[next];
        if (intent === "pause") {
          setDownloads((list) => list.map((d) => (d.id === next ? { ...d, status: "paused" } : d)));
        } else if (intent === "cancel") {
          setDownloads((list) => list.filter((d) => d.id !== next));
          delete metaRef.current[next];
        } else {
          failOrRetry(next, e?.message || String(e));
        }
      })
      .finally(() => {
        runningRef.current.delete(next);
        pump();
      });
  }

  function enqueue(rec: DownloadRecord, meta: TaskMeta) {
    metaRef.current[rec.id] = meta;
    queueRef.current.push(rec.id);
    pump();
  }

  function pauseItem(id: string) {
    if (runningRef.current.has(id)) {
      intentRef.current[id] = "pause";
      ytdlpCancel(id);
    }
  }

  /** Put paused/failed items back in the queue (a manual retry gets fresh auto-retries). */
  function requeue(ids: string[]) {
    if (ids.length === 0) return;
    const set = new Set(ids);
    ids.forEach((id) => (attemptsRef.current[id] = 0));
    setDownloads((list) => list.map((d) => (set.has(d.id) ? { ...d, status: "queued", progress: -1, statusLine: undefined } : d)));
    ids.forEach((id) => {
      if (!queueRef.current.includes(id) && !runningRef.current.has(id)) queueRef.current.push(id);
    });
    pump();
  }

  function resumeItem(id: string) {
    requeue([id]);
  }

  function retryFailed() {
    requeue(downloads.filter((d) => d.status === "failed").map((d) => d.id));
  }

  function cancelItem(id: string) {
    if (runningRef.current.has(id)) {
      intentRef.current[id] = "cancel";
      ytdlpCancel(id);
    } else {
      queueRef.current = queueRef.current.filter((x) => x !== id);
      delete metaRef.current[id];
      setDownloads((list) => list.filter((d) => d.id !== id));
    }
  }

  // ----- whole-playlist (batch) controls -----
  function pauseBatch(batchId: string) {
    const recs = downloads.filter((d) => d.batchId === batchId);
    recs.forEach((d) => {
      if (d.status === "running") {
        intentRef.current[d.id] = "pause";
        ytdlpCancel(d.id);
      }
    });
    const ids = new Set(recs.filter((d) => d.status === "queued").map((d) => d.id));
    queueRef.current = queueRef.current.filter((id) => !ids.has(id));
    setDownloads((list) => list.map((d) => (d.batchId === batchId && d.status === "queued" ? { ...d, status: "paused" } : d)));
  }

  function resumeBatch(batchId: string) {
    requeue(downloads.filter((d) => d.batchId === batchId && (d.status === "paused" || d.status === "failed")).map((d) => d.id));
  }

  function cancelBatch(batchId: string) {
    const recs = downloads.filter((d) => d.batchId === batchId);
    recs.forEach((d) => {
      if (d.status === "running") {
        intentRef.current[d.id] = "cancel";
        ytdlpCancel(d.id);
      }
    });
    const removeIds = new Set(recs.filter((d) => d.status !== "completed" && d.status !== "running").map((d) => d.id));
    queueRef.current = queueRef.current.filter((id) => !removeIds.has(id));
    removeIds.forEach((id) => delete metaRef.current[id]);
    setDownloads((list) => list.filter((d) => !removeIds.has(d.id)));
  }

  async function handleDownload(opts: DownloadRequest) {
    // Links from the share sheet / detection skip the Home form's check.
    if (!isValidUrl(opts.url)) {
      sfx.error();
      return flash(t("invalid_url"));
    }
    // Same video, same mode, already on disk → offer to open it instead.
    if (!opts.force && !opts.clip && !opts.isPlaylist) {
      const prev = findDownloaded(downloadsRef.current, opts.url, opts.audioOnly);
      if (prev) {
        setDupe({ req: opts, rec: prev });
        return;
      }
    }
    flash(t("started"));
    sfx.start();
    if (!opts.stay) setTab("downloads");

    const baseName = opts.info?.title || opts.url.replace(/^https?:\/\//, "").slice(0, 60);
    const niceName = opts.clip ? `${baseName} ✂ ${opts.clip.start}–${opts.clip.end}` : baseName;

    if (!isNative()) {
      const id = newId();
      setDownloads((list) => [
        { id, managerId: -1, url: opts.url, filename: niceName, title: niceName, platform: opts.platform, audioOnly: opts.audioOnly, createdAt: Date.now(), status: "completed", progress: 100, thumbnail: opts.info?.thumbnail },
        ...list,
      ]);
      browserDownload(opts.url, niceName);
      return;
    }

    // Options are saved on each record so it can be resumed after a restart.
    const saved = { quality: opts.quality, audioFormat: opts.audioFormat, subLang: opts.subLang, clip: opts.clip };
    const metaFor = (url: string, title: string): TaskMeta => ({ url, audioOnly: opts.audioOnly, title, ...saved });

    // Show a card IMMEDIATELY — no waiting for extraction.
    const id0 = newId();
    const placeholder: DownloadRecord = {
      id: id0, managerId: -1, url: opts.url, filename: niceName, title: niceName,
      platform: opts.platform, audioOnly: opts.audioOnly, createdAt: Date.now(),
      status: "queued", progress: -1, thumbnail: opts.info?.thumbnail, ...saved,
    };
    setDownloads((list) => [placeholder, ...list]);

    // Single link: start downloading right away (no enumeration delay).
    if (!opts.isPlaylist) {
      enqueue(placeholder, metaFor(opts.url, niceName));
      return;
    }

    // Playlist: enumerate in the background, then replace the placeholder with
    // one card per video.
    // (the Home screen may have enumerated it already and let the user pick)
    let entries: { url: string; title: string; thumbnail?: string }[] = opts.entries || [];
    let plTitle: string | undefined = opts.playlistTitle;
    if (!opts.entries) {
      try {
        const r = await ytdlpPlaylist(opts.url);
        entries = r.entries && r.entries.length ? r.entries : [];
        plTitle = r.title;
      } catch {
        entries = [];
      }
    }
    if (opts.entries && entries.length === 1) {
      // a single pick from a playlist is just a normal download
      const one = entries[0];
      const rec = { ...placeholder, url: one.url, title: one.title, filename: one.title, thumbnail: one.thumbnail };
      setDownloads((list) => list.map((d) => (d.id === id0 ? rec : d)));
      enqueue(rec, metaFor(one.url, one.title));
      return;
    }
    if (entries.length <= 1) {
      // not actually a playlist (or failed) — just download the single link
      enqueue(placeholder, metaFor(opts.url, niceName));
      return;
    }

    const batchId = newId();
    const batchTitle = plTitle || `${t("playlist")} · ${entries.length}`;
    const recs: DownloadRecord[] = entries.map((e) => ({
      id: newId(), managerId: -1, url: e.url, filename: e.title, title: e.title,
      platform: opts.platform, audioOnly: opts.audioOnly, createdAt: Date.now(),
      status: "queued", progress: -1, thumbnail: e.thumbnail, batchId, batchTitle, ...saved,
    }));
    setDownloads((list) => [...recs, ...list.filter((d) => d.id !== id0)]);
    recs.forEach((r) => enqueue(r, metaFor(r.url, r.title)));
  }

  const openRecord = (d: DownloadRecord) => d.localUri && openFile(d.localUri, d.audioOnly ? "audio/*" : "video/*");
  const doneKeys = useMemo(() => downloadedKeys(downloads), [downloads]);

  // Drag a link from the browser onto the window → the usual download prompt.
  useEffect(() => {
    let depth = 0;
    const hasLink = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].some((x) => x === "text/uri-list" || x === "text/plain");
    const over = (e: DragEvent) => { if (hasLink(e)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; } };
    const enter = (e: DragEvent) => { if (hasLink(e)) { depth++; setDragging(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const raw = (e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain") || "")
        .split(/\r?\n/).map((x) => x.trim()).find((x) => x && !x.startsWith("#"));
      if (raw && isValidUrl(raw)) setConfirmUrl(raw);
      else if (raw) { sfx.error(); flash(t("invalid_url")); }
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [t]);

  if (intro) {
    return <Intro tagline={t("app_tagline")} onSkip={() => setIntro(false)} />;
  }

  if (!ready) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center" }}>
        <div className="glow"><KewLogo size={110} /></div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header lang={settings.lang} t={t} onLang={(l) => patchSettings({ lang: l })} />

      <div className="content">
        <div className="screen" key={tab}>
          {tab === "home" && <HomeScreen t={t} settings={settings} onDownload={handleDownload} flash={flash} downloaded={doneKeys} />}
          {tab === "downloads" && (
            <DownloadsScreen
              t={t}
              downloads={downloads}
              onPlay={(d) => { setPlaying(d); setTab("player"); }}
              onOpen={openRecord}
              onDelete={(id) => { sfx.remove(); setDownloads((l) => l.filter((x) => x.id !== id)); }}
              onPause={pauseItem}
              onResume={resumeItem}
              onCancel={cancelItem}
              onPauseBatch={pauseBatch}
              onResumeBatch={resumeBatch}
              onCancelBatch={cancelBatch}
              onRetryFailed={retryFailed}
              batchTitle={(id) => downloads.find((d) => d.batchId === id)?.batchTitle || t("playlist")}
              onFolder={(d) => showInFolder(d.localUri)}
              onClearDone={() => {
                if (window.confirm(t("confirm_delete"))) setDownloads((l) => l.filter((x) => x.status !== "completed"));
              }}
            />
          )}
          {tab === "player" && <PlayerScreen t={t} item={playing} onOpen={openRecord} />}
          {tab === "about" && <AboutScreen t={t} settings={settings} patchSettings={patchSettings} flash={flash} />}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {dupe && (
        <DupeDialog
          t={t}
          rec={dupe.rec}
          onOpen={() => { const r = dupe.rec; setDupe(null); if (r.audioOnly || !r.playUri) openRecord(r); else { setPlaying(r); setTab("player"); } }}
          onAgain={() => { const req = dupe.req; setDupe(null); handleDownload({ ...req, force: true }); }}
          onClose={() => setDupe(null)}
        />
      )}

      {dragging && (
        <div className="drop-overlay"><div className="drop-box"><Download size={34} /> {t("drop_here")}</div></div>
      )}

      {confirmUrl && (
        <ConfirmDialog
          key={confirmUrl}
          t={t}
          url={confirmUrl}
          settings={settings}
          onClose={() => setConfirmUrl(null)}
          onConfirm={(req) => {
            setConfirmUrl(null);
            handleDownload(req);
          }}
        />
      )}

      <nav className={"tabs" + (kbOpen ? " hidden" : "")} style={{ "--i": TAB_ORDER.indexOf(tab) } as CSSProperties}>
        <span className="tab-ind" aria-hidden="true" />
        <TabBtn ico={<House />} label={t("nav_home")} on={tab === "home"} onClick={() => setTab("home")} />
        <TabBtn ico={<Download />} label={t("nav_downloads")} on={tab === "downloads"} onClick={() => setTab("downloads")} />
        <TabBtn ico={<CirclePlay />} label={t("nav_player")} on={tab === "player"} onClick={() => setTab("player")} />
        <TabBtn ico={<SettingsIcon />} label={t("nav_about")} on={tab === "about"} onClick={() => setTab("about")} />
      </nav>
    </div>
  );
}
