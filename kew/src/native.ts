// Kew — bridges to the native Android plugins.
//   KewYtdlp     — on-device yt-dlp extraction + download (no server).
//   KewDownloader — generic DownloadManager + open-with-system helper.
// Falls back to a plain browser download when running in a web context.

import { registerPlugin, Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { DEMO, demoInfo, demoMedia, demoPlaylist, demoSearch } from "./demo";

export interface YtFile {
  name: string;
  path: string;
  uri: string;
  mime: string;
}

export interface ProgressEvent {
  taskId: string;
  progress: number; // 0..100, or -1 while preparing
  eta: number;
  line: string;
}

export interface Quality {
  height: number;
  size: number; // expected bytes (0 = unknown)
}

export interface MediaInfo {
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  extractor?: string;
  /** real video qualities (highest first) with the expected file size */
  qualities?: Quality[];
  audioSize?: number;
}

export type SearchSource = "yt" | "sc";

/** Download only part of a video: "1:30" … "2:45". */
export interface Clip {
  start: string;
  end: string;
}

export interface SearchResult {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
}

export interface PlaylistEntry {
  url: string;
  title: string;
  thumbnail?: string;
}

export interface DeviceMediaItem {
  title: string;
  name: string;
  path: string;
  duration: number; // seconds
  artist?: string;
  album?: string;
}

export interface KewYtdlpPlugin {
  download(opts: {
    url: string;
    audioOnly: boolean;
    audioFormat?: string;
    subLang?: string;
    quality: string;
    taskId: string;
    title?: string;
    notify?: boolean;
    sound?: boolean;
    clip?: Clip;
  }): Promise<{ files: YtFile[] }>;
  openDownloadsFolder(): Promise<void>;
  consumeShare(): Promise<{ url?: string }>;
  listMedia(opts: { type: string }): Promise<{ items: DeviceMediaItem[] }>;
  videoThumb(opts: { path: string }): Promise<{ thumb?: string }>;
  mediaSession(opts: MediaSessionState): Promise<void>;
  info(opts: { url: string }): Promise<MediaInfo>;
  playlist(opts: { url: string }): Promise<{ entries: PlaylistEntry[]; title?: string }>;
  search(opts: { query: string; limit: number; source: SearchSource }): Promise<{ results: SearchResult[] }>;
  notifyDone(opts: { title: string; sound: boolean }): Promise<void>;
  readClipboard(): Promise<{ text: string }>;
  playKeklik(): Promise<void>;
  setBusy(opts: { active: boolean; text?: string }): Promise<void>;
  cancel(opts: { taskId: string }): Promise<void>;
  addListener(
    event: "progress",
    cb: (data: ProgressEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "mediaControl",
    cb: (data: MediaControlEvent) => void
  ): Promise<PluginListenerHandle>;
}

export interface MediaSessionState {
  active: boolean;
  title?: string;
  playing?: boolean;
  position?: number; // ms
  duration?: number; // ms
  rate?: number;
}

export interface MediaControlEvent {
  cmd: "play" | "pause" | "toggle" | "next" | "prev" | "seek";
  pos?: number; // ms (seek)
}

export interface KewDownloaderPlugin {
  enqueue(opts: { url: string; filename: string; title?: string }): Promise<{ id: number }>;
  query(opts: { id: number }): Promise<{ status: string; bytesDownloaded: number; bytesTotal: number; localUri?: string }>;
  openFile(opts: { uri: string; mime?: string }): Promise<void>;
}

const KewYtdlp = registerPlugin<KewYtdlpPlugin>("KewYtdlp");
const KewDownloader = registerPlugin<KewDownloaderPlugin>("KewDownloader");

export const isNative = () => Capacitor.isNativePlatform() || DEMO;

export function ytdlpDownload(opts: {
  url: string;
  audioOnly: boolean;
  audioFormat?: string;
  subLang?: string;
  quality: string;
  taskId: string;
  title?: string;
  notify?: boolean;
  sound?: boolean;
  clip?: Clip;
}) {
  return KewYtdlp.download(opts);
}

/** Open the Downloads/Kew folder in the system file manager. */
export function showInFolder(_uriOrPath?: string) {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.openDownloadsFolder().catch(() => {});
}

/** All videos or music on the device, ready to play in the WebView. */
export async function listMedia(type: "video" | "audio"): Promise<(DeviceMediaItem & { src: string })[]> {
  if (DEMO) return type === "audio" ? demoMedia : [];
  if (!isNative()) return [];
  const r = await KewYtdlp.listMedia({ type }); // rejects with "no-permission" until granted
  return (r.items || []).map((x) => ({ ...x, src: toPlayableSrc(x.path) }));
}

/** Cached video frame preview (jpg) for the library list, or null. */
export async function videoThumb(path?: string): Promise<string | null> {
  if (!isNative() || !path) return null;
  try {
    const r = await KewYtdlp.videoThumb({ path });
    return r?.thumb ? toPlayableSrc(r.thumb) : null;
  } catch {
    return null;
  }
}

/** Keep playback alive in the background + drive the lock-screen player. */
export function mediaSession(state: MediaSessionState) {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.mediaSession(state).catch(() => {});
}

/** Lock-screen / notification media buttons pressed by the user. */
export function onMediaControl(cb: (e: MediaControlEvent) => void) {
  return KewYtdlp.addListener("mediaControl", cb);
}

/** Take (and clear) a URL shared into Kew via the Android share sheet. */
export async function consumeShare(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const r = await KewYtdlp.consumeShare();
    return r?.url || null;
  } catch {
    return null;
  }
}

export function ytdlpInfo(url: string) {
  if (DEMO) return Promise.resolve(demoInfo);
  return KewYtdlp.info({ url });
}

export function ytdlpPlaylist(url: string) {
  if (DEMO) return Promise.resolve(demoPlaylist);
  return KewYtdlp.playlist({ url });
}

export async function ytdlpSearch(query: string, limit = 12, source: SearchSource = "yt"): Promise<SearchResult[]> {
  if (DEMO) return demoSearch;
  if (!isNative()) return [];
  return (await KewYtdlp.search({ query, limit, source })).results || [];
}

export function ytdlpSetBusy(active: boolean, text?: string) {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.setBusy({ active, text }).catch(() => {});
}

export function ytdlpNotifyDone(title: string, sound: boolean) {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.notifyDone({ title, sound }).catch(() => {});
}

// Read clipboard text: native on Android (WebView blocks the web API),
// falling back to navigator.clipboard elsewhere.
export async function readClipboardText(): Promise<string> {
  if (isNative()) {
    try {
      const r = await KewYtdlp.readClipboard();
      if (r && typeof r.text === "string") return r.text;
    } catch {}
  }
  try {
    return (await navigator.clipboard.readText()) || "";
  } catch {
    return "";
  }
}

export function ytdlpPlayKeklik() {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.playKeklik().catch(() => {});
}

export function ytdlpCancel(taskId: string) {
  return KewYtdlp.cancel({ taskId });
}

// Convert a real filesystem path into a URL the WebView <video> can load.
export function toPlayableSrc(pathOrUri: string): string {
  if (!isNative()) return pathOrUri;
  try {
    return Capacitor.convertFileSrc(pathOrUri);
  } catch {
    return pathOrUri;
  }
}

export function onYtdlpProgress(cb: (e: ProgressEvent) => void) {
  return KewYtdlp.addListener("progress", cb);
}

export async function openFile(uri: string, mime = "video/*") {
  if (isNative()) {
    await KewDownloader.openFile({ uri, mime });
  } else {
    window.open(uri, "_blank");
  }
}

// Web-only fallback: trigger a normal browser download for a direct URL.
export function browserDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export { KewYtdlp, KewDownloader };

// ---- shared-UI contract: things the desktop build has and Android doesn't ----

export const isDesktop = false;

/** Desktop tray/autostart/detection prefs — nothing to do on Android. */
export function setDesktopPrefs(_p: {
  watchBrowser?: boolean;
  watchClipboard?: boolean;
  autoStart?: boolean;
  labels?: { show?: string; quit?: string };
}) {
  return Promise.resolve();
}

/** Desktop "video detected" notifications; Android uses the share sheet instead. */
export function onDetectedUrl(_cb: (url: string) => void): () => void {
  return () => {};
}

/** yt-dlp version, or null where it isn't reported (Android updates it itself). */
export async function engineVersion(): Promise<string | null> {
  return null;
}

export async function engineUpdate(): Promise<{ ok: boolean; version?: string }> {
  return { ok: false };
}

// ---- key/value storage for settings + download history ----

export async function kvGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

export async function kvSet(key: string, value: string) {
  await Preferences.set({ key, value });
}

/** Per-platform one-off settings migrations (none on Android). */
export function migrateSettings<T>(s: T): T {
  return s;
}

// ---- save folder: Android always publishes to Downloads/Kew (MediaStore) ----
export const canChooseFolder = false;
export interface SaveFolder {
  path: string;
  custom: boolean;
}
export function getSaveFolder(): Promise<SaveFolder | null> {
  return Promise.resolve(null);
}
export function chooseSaveFolder(): Promise<SaveFolder | null> {
  return Promise.resolve(null);
}
export function resetSaveFolder(): Promise<SaveFolder | null> {
  return Promise.resolve(null);
}
