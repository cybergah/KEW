// Kew — persistent download records + settings via Capacitor Preferences.

import { Preferences } from "@capacitor/preferences";
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
  thumbnail?: string;
  bytesTotal?: number;
  progress?: number; // 0..100 (-1 = preparing)
  statusLine?: string;
  batchId?: string; // groups all items of one playlist download
}

export interface Settings {
  lang: Lang;
  server: string;
  quality: string;
  audioOnly: boolean;
  notify: boolean; // show "download complete" notification
  sound: boolean; // play the keklik call on completion
}

const K_DOWNLOADS = "kew.downloads";
const K_SETTINGS = "kew.settings";

// Default extraction instance — change in Settings or self-host.
export const DEFAULT_SETTINGS: Settings = {
  lang: "ku",
  server: "https://co.itzng.cc",
  quality: "1080",
  audioOnly: false,
  notify: true,
  sound: true,
};

export async function loadSettings(): Promise<Settings> {
  const { value } = await Preferences.get({ key: K_SETTINGS });
  if (!value) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(value) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Settings) {
  await Preferences.set({ key: K_SETTINGS, value: JSON.stringify(s) });
}

export async function loadDownloads(): Promise<DownloadRecord[]> {
  const { value } = await Preferences.get({ key: K_DOWNLOADS });
  if (!value) return [];
  try {
    return JSON.parse(value) as DownloadRecord[];
  } catch {
    return [];
  }
}

export async function saveDownloads(list: DownloadRecord[]) {
  await Preferences.set({ key: K_DOWNLOADS, value: JSON.stringify(list) });
}

export function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
