// Kew — persistent download records + settings. The key/value backend comes
// from the platform bridge (Capacitor Preferences on Android, localStorage on
// Windows), so this file is shared by both builds.

import { kvGet, kvSet, migrateSettings } from "@native";
import type { Lang } from "./i18n";
import type { Platform } from "./platform";

export interface DownloadRecord {
  id: string;
  managerId: number; // Android DownloadManager id (-1 on web)
  url: string;
  filename: string;
  title: string;
  platform: Platform;
  audioOnly: boolean;
  createdAt: number;
  status: "queued" | "running" | "paused" | "completed" | "failed";
  localUri?: string; // public uri (Downloads/Kew) for "open with"
  playUri?: string; // WebView-playable src (convertFileSrc of app-dir path)
  subUri?: string; // playable subtitle (.vtt) src for the in-app player
  thumbnail?: string;
  bytesTotal?: number;
  progress?: number; // 0..100 (-1 = preparing)
  statusLine?: string;
  batchId?: string; // groups all items of one playlist download
  batchTitle?: string; // playlist name, kept with the items so it survives a restart
  // Download options, kept so paused/failed items can be resumed after a restart.
  quality?: string;
  audioFormat?: string;
  subLang?: string;
  clip?: { start: string; end: string }; // only this part was downloaded
}

export type AudioFormat = "mp3" | "m4a" | "opus";

export interface Settings {
  lang: Lang;
  quality: string;
  audioOnly: boolean;
  audioFormat: AudioFormat; // m4a copies the stream (fast); mp3/opus re-encode
  concurrent: number; // simultaneous downloads (1-3)
  subs: boolean; // embed subtitles into the video
  subLang: string; // subtitle language code (tr/ku/en/ar/fa)
  notify: boolean; // show "download complete" notification
  sound: boolean; // play the keklik call on completion
  uiSounds: boolean; // short synthesized sounds for taps, tabs, start, errors
  // Desktop only (ignored on Android):
  watchBrowser: boolean; // extension reports the video you're watching
  watchClipboard: boolean; // fallback: detect copied links
  autoStart: boolean; // start with Windows, minimized to tray
}

const K_DOWNLOADS = "kew.downloads";
const K_SETTINGS = "kew.settings";

/** Finished/failed records kept in history; active ones are never dropped. */
export const MAX_HISTORY = 500;

export const DEFAULT_SETTINGS: Settings = {
  lang: "ku",
  quality: "1080",
  audioOnly: false,
  audioFormat: "m4a",
  concurrent: 2,
  subs: false,
  subLang: "tr",
  notify: true,
  sound: true,
  uiSounds: true,
  watchBrowser: true,
  watchClipboard: true,
  autoStart: true,
};

export async function loadSettings(): Promise<Settings> {
  const value = await kvGet(K_SETTINGS);
  let s: Settings = { ...DEFAULT_SETTINGS };
  if (value) {
    try {
      s = { ...DEFAULT_SETTINGS, ...JSON.parse(value) };
    } catch {}
  }
  delete (s as any).server; // v1 Cobalt setting, no longer used
  return migrateSettings(s);
}

export async function saveSettings(s: Settings) {
  await kvSet(K_SETTINGS, JSON.stringify(s));
}

export async function loadDownloads(): Promise<DownloadRecord[]> {
  const value = await kvGet(K_DOWNLOADS);
  if (!value) return [];
  try {
    return normalizeLoaded(JSON.parse(value) as DownloadRecord[]);
  } catch {
    return [];
  }
}

export async function saveDownloads(list: DownloadRecord[]) {
  await kvSet(K_DOWNLOADS, JSON.stringify(trimHistory(list)));
}

/**
 * No download process survives an app restart, so anything that was running
 * or waiting is shown as paused (resumable) instead of hanging forever.
 */
export function normalizeLoaded(list: DownloadRecord[]): DownloadRecord[] {
  if (!Array.isArray(list)) return [];
  return list.map((d) =>
    d.status === "running" || d.status === "queued" ? { ...d, status: "paused" } : d
  );
}

/** Keep every active record plus the newest `max` finished/failed ones. */
export function trimHistory(list: DownloadRecord[], max = MAX_HISTORY): DownloadRecord[] {
  let kept = 0;
  return list.filter((d) => {
    if (d.status !== "completed" && d.status !== "failed") return true;
    kept++;
    return kept <= max;
  });
}

/**
 * Debounced writer: progress events change the list several times a second,
 * but the history only needs to hit storage once things settle. `flush()`
 * writes immediately (used when the app goes to the background).
 */
export function createSaver(write: (list: DownloadRecord[]) => unknown, delay = 1000) {
  let pending: DownloadRecord[] | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (pending) {
      const p = pending;
      pending = null;
      write(p);
    }
  };
  const schedule = (list: DownloadRecord[]) => {
    pending = list;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };
  return { schedule, flush };
}

export function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
