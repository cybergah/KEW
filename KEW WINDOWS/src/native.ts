// Kew for Windows — bridge to the Electron main process (yt-dlp.exe).
// Same exported API as the Android bridge (kew/src/native.ts), so the shared
// UI in ../shared works unchanged on both.
import keklikUrl from "@shared/assets/keklik.wav";
import logoUrl from "@shared/assets/keklik.svg";

const kew: any = (window as any).kew || {};

export interface YtFile { name: string; path: string; uri: string; mime: string }
export interface ProgressEvent { taskId: string; progress: number; eta?: number; line: string }
export interface Quality { height: number; size: number }
export interface MediaInfo {
  title: string; thumbnail?: string; duration?: number; uploader?: string; extractor?: string;
  /** real video qualities (highest first) with the expected file size in bytes */
  qualities?: Quality[];
  audioSize?: number;
}
export type SearchSource = "yt" | "sc";
export interface Clip { start: string; end: string }
export interface PlaylistEntry { url: string; title: string; thumbnail?: string }

export interface SearchResult { url: string; title: string; thumbnail?: string; duration?: number; uploader?: string }

export const isNative = () => true; // desktop has the native engine

export function ytdlpInfo(url: string): Promise<MediaInfo> {
  return kew.info(url);
}
export function ytdlpPlaylist(url: string): Promise<{ entries: PlaylistEntry[]; title?: string }> {
  return kew.playlist(url);
}

export async function ytdlpSearch(query: string, limit = 12, source: SearchSource = "yt"): Promise<SearchResult[]> {
  return (await kew.search(query, limit, source)) || [];
}

export async function ytdlpDownload(opts: {
  url: string; audioOnly: boolean; audioFormat?: string; subLang?: string; quality: string; taskId: string;
  title?: string; notify?: boolean; sound?: boolean; clip?: Clip;
}): Promise<{ files: YtFile[] }> {
  const r = await kew.download(opts);
  // completion sound is played here (notification is shown by the main process)
  if (r && r.files && r.files.length > 0 && opts.sound) ytdlpPlayKeklik();
  return r;
}

export function ytdlpCancel(taskId: string) {
  return kew.cancel(taskId);
}

export function ytdlpSetBusy(_active: boolean, _text?: string) {
  return Promise.resolve(); // no foreground service needed on desktop
}

export function ytdlpNotifyDone(title: string, _sound: boolean) {
  return kew.notify(title);
}

export function ytdlpPlayKeklik() {
  try {
    const a = new Audio(keklikUrl);
    a.volume = 0.9;
    a.play().catch(() => {});
  } catch {}
  return Promise.resolve();
}

export function onYtdlpProgress(cb: (e: ProgressEvent) => void) {
  const remove = kew.onProgress ? kew.onProgress(cb) : () => {};
  return Promise.resolve({ remove });
}

// ---- desktop-only: tray/autostart/detection prefs + detected-video events ----

export function setDesktopPrefs(p: {
  watchBrowser?: boolean;
  watchClipboard?: boolean;
  autoStart?: boolean;
  labels?: { show?: string; quit?: string };
}) {
  return kew.setPrefs ? kew.setPrefs(p) : Promise.resolve();
}

/** The user clicked a "video detected — download?" notification. */
export function onDetectedUrl(cb: (url: string) => void): () => void {
  return kew.onDetectedUrl ? kew.onDetectedUrl(cb) : () => {};
}

export async function openFile(uri: string, _mime?: string) {
  await kew.openPath(uri);
}

/** Reveal the downloaded file in Explorer (falls back to opening the folder). */
export function showInFolder(uriOrPath?: string) {
  return kew.showInFolder ? kew.showInFolder(uriOrPath || "") : Promise.resolve();
}

/** Android-only concept; no share sheet on desktop. */
export async function consumeShare(): Promise<string | null> {
  return null;
}

// ---- media player bridge (desktop equivalents of the Android natives) ----

export interface DeviceMediaItem {
  title: string;
  name: string;
  path: string;
  duration: number;
  artist?: string;
  album?: string;
}

/** Scan Downloads\Kew + Videos + Music + Downloads for playable media. */
export async function listMedia(type: "video" | "audio"): Promise<(DeviceMediaItem & { src: string })[]> {
  if (!kew.listMedia) return [];
  const items: DeviceMediaItem[] = (await kew.listMedia(type)) || [];
  return items.map((x) => ({ ...x, src: toPlayableSrc(x.path) }));
}

/** Video frame previews are Android-only for now. */
export async function videoThumb(_path?: string): Promise<string | null> {
  return null;
}

export interface MediaSessionState {
  active: boolean;
  title?: string;
  playing?: boolean;
  position?: number;
  duration?: number;
  rate?: number;
}

export interface MediaControlEvent {
  cmd: "play" | "pause" | "toggle" | "next" | "prev" | "seek";
  pos?: number;
}

// Desktop playback keeps running with the window closed to the tray / menu
// bar. The browser Media Session API feeds the OS media keys and the macOS
// "Now Playing" widget (Windows: the media flyout).
export function mediaSession(state: MediaSessionState) {
  const ms = navigator.mediaSession;
  if (!ms) return Promise.resolve();
  try {
    if (!state.active) {
      ms.metadata = null;
      ms.playbackState = "none";
      return Promise.resolve();
    }
    if (!ms.metadata || ms.metadata.title !== state.title) {
      ms.metadata = new MediaMetadata({ title: state.title || "Kew", artist: "Kew", artwork: [{ src: logoUrl, sizes: "256x256" }] });
    }
    ms.playbackState = state.playing ? "playing" : "paused";
    const dur = (state.duration || 0) / 1000;
    if (dur > 0) ms.setPositionState({ duration: dur, position: Math.min((state.position || 0) / 1000, dur), playbackRate: state.rate || 1 });
  } catch {}
  return Promise.resolve();
}

export function onMediaControl(cb: (e: MediaControlEvent) => void): Promise<{ remove: () => void }> {
  const ms = navigator.mediaSession;
  if (!ms) return Promise.resolve({ remove: () => {} });
  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => cb({ cmd: "play" })],
    ["pause", () => cb({ cmd: "pause" })],
    ["nexttrack", () => cb({ cmd: "next" })],
    ["previoustrack", () => cb({ cmd: "prev" })],
    ["seekto", (d) => typeof d.seekTime === "number" && cb({ cmd: "seek", pos: d.seekTime * 1000 })],
  ];
  const set = (h: boolean) => actions.forEach(([a, fn]) => { try { ms.setActionHandler(a, h ? fn : null); } catch {} });
  set(true);
  return Promise.resolve({ remove: () => set(false) });
}

export function browserDownload(url: string, _filename: string) {
  window.open(url, "_blank");
}

// Convert a filesystem path / file-uri into a <video>-playable src. Media is
// served by the main process on kew-media:// (see electron/security.cjs),
// which only exposes files inside the user's media folders. Older history
// entries stored file:/// URLs; they are converted here too.
export function toPlayableSrc(pathOrUri: string): string {
  if (!pathOrUri || pathOrUri.startsWith("kew-media:")) return pathOrUri;
  let p = pathOrUri;
  if (p.startsWith("file:")) {
    try {
      p = decodeURIComponent(new URL(p).pathname);
      if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1).replace(/\//g, "\\"); // file:///C:/a/b → C:\a\b
    } catch {
      return pathOrUri;
    }
  }
  return "kew-media://media/" + encodeURIComponent(p);
}

export const isDesktop = true;

/** Paste button: the Electron renderer can use the web clipboard API. */
export async function readClipboardText(): Promise<string> {
  try {
    return (await navigator.clipboard.readText()) || "";
  } catch {
    return "";
  }
}

// ---- yt-dlp.exe version + manual update (Settings) ----

export async function engineVersion(): Promise<string | null> {
  if (!kew.engineVersion) return null;
  try {
    return (await kew.engineVersion()) || null;
  } catch {
    return null;
  }
}

export function engineUpdate(): Promise<{ ok: boolean; version?: string }> {
  return kew.engineUpdate ? kew.engineUpdate() : Promise.resolve({ ok: false });
}

// ---- key/value storage for settings + download history ----

export async function kvGet(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/**
 * Clipboard watch used to default to off; it is now the extension-less
 * detection path (Firefox), so switch it on once for existing installs.
 */
export function migrateSettings<T extends { watchClipboard: boolean }>(s: T): T {
  try {
    if (!localStorage.getItem("kew.clipwatch.migrated")) {
      localStorage.setItem("kew.clipwatch.migrated", "1");
      return { ...s, watchClipboard: true };
    }
  } catch {}
  return s;
}

// ---- save folder (desktop only) ----
export const canChooseFolder = true;
export interface SaveFolder { path: string; custom: boolean }
export function getSaveFolder(): Promise<SaveFolder | null> {
  return kew.getFolder ? kew.getFolder() : Promise.resolve(null);
}
export function chooseSaveFolder(): Promise<SaveFolder | null> {
  return kew.chooseFolder ? kew.chooseFolder() : Promise.resolve(null);
}
export function resetSaveFolder(): Promise<SaveFolder | null> {
  return kew.resetFolder ? kew.resetFolder() : Promise.resolve(null);
}
