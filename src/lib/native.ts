// Kew — bridges to the native Android plugins.
//   KewYtdlp     — on-device yt-dlp extraction + download (no server).
//   KewDownloader — generic DownloadManager + open-with-system helper.
// Falls back to a plain browser download when running in a web context.

import { registerPlugin, Capacitor, type PluginListenerHandle } from "@capacitor/core";

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

export interface MediaInfo {
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  extractor?: string;
}

export interface PlaylistEntry {
  url: string;
  title: string;
  thumbnail?: string;
}

export interface KewYtdlpPlugin {
  download(opts: {
    url: string;
    audioOnly: boolean;
    quality: string;
    taskId: string;
  }): Promise<{ files: YtFile[] }>;
  info(opts: { url: string }): Promise<MediaInfo>;
  playlist(opts: { url: string }): Promise<{ entries: PlaylistEntry[]; title?: string }>;
  notifyDone(opts: { title: string; sound: boolean }): Promise<void>;
  playKeklik(): Promise<void>;
  setBusy(opts: { active: boolean; text?: string }): Promise<void>;
  cancel(opts: { taskId: string }): Promise<void>;
  addListener(
    event: "progress",
    cb: (data: ProgressEvent) => void
  ): Promise<PluginListenerHandle>;
}

export interface KewDownloaderPlugin {
  enqueue(opts: { url: string; filename: string; title?: string }): Promise<{ id: number }>;
  query(opts: { id: number }): Promise<{ status: string; bytesDownloaded: number; bytesTotal: number; localUri?: string }>;
  openFile(opts: { uri: string; mime?: string }): Promise<void>;
}

const KewYtdlp = registerPlugin<KewYtdlpPlugin>("KewYtdlp");
const KewDownloader = registerPlugin<KewDownloaderPlugin>("KewDownloader");

export const isNative = () => Capacitor.isNativePlatform();

export function ytdlpDownload(opts: { url: string; audioOnly: boolean; quality: string; taskId: string }) {
  return KewYtdlp.download(opts);
}

export function ytdlpInfo(url: string) {
  return KewYtdlp.info({ url });
}

export function ytdlpPlaylist(url: string) {
  return KewYtdlp.playlist({ url });
}

export function ytdlpSetBusy(active: boolean, text?: string) {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.setBusy({ active, text }).catch(() => {});
}

export function ytdlpNotifyDone(title: string, sound: boolean) {
  if (!isNative()) return Promise.resolve();
  return KewYtdlp.notifyDone({ title, sound }).catch(() => {});
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
