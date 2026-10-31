// Kew — pure helpers for download options: link identity (to spot repeats),
// clip times and human-readable sizes.

import type { DownloadRecord } from "./store";

/** A stable key for "the same video": YouTube ids across youtu.be / watch /
 *  shorts / music links; otherwise the URL without hash, query noise and
 *  trailing slash. */
export function urlKey(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "").toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host.endsWith("youtube.com")) {
    id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/) || [])[1] || null;
  }
  if (id) return "yt:" + id;
  for (const p of [...u.searchParams.keys()]) if (/^(utm_|si$|feature$|ref$)/.test(p)) u.searchParams.delete(p);
  return host + u.pathname.replace(/\/+$/, "") + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
}

/** The finished download of the same video in the same mode (video / audio), if any. */
export function findDownloaded(list: DownloadRecord[], url: string, audioOnly: boolean): DownloadRecord | undefined {
  const k = urlKey(url);
  return list.find((d) => d.status === "completed" && !d.clip && d.audioOnly === audioOnly && urlKey(d.url) === k);
}

/** Keys of everything already downloaded (any mode) — for "downloaded" badges. */
export function downloadedKeys(list: DownloadRecord[]): Set<string> {
  return new Set(list.filter((d) => d.status === "completed").map((d) => urlKey(d.url)));
}

/** "90", "1:30", "01:02:03", "75.5" → seconds (or null). Same rules as the
 *  desktop/Android engines, which validate again. */
export function parseTime(raw: string): number | null {
  const s = (raw || "").trim();
  if (!/^\d{1,3}(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function validClip(start: string, end: string, duration?: number): boolean {
  const a = parseTime(start), b = parseTime(end);
  if (a == null || b == null || b <= a) return false;
  return !duration || a < duration;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? h + ":" : "") + mm + ":" + String(r).padStart(2, "0");
}

/** 84_000_000 → "84 MB", 1_400_000_000 → "1.4 GB"; 0/unknown → "". */
export function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / 1e6;
  if (mb >= 1000) return (mb / 1000).toFixed(1).replace(/\.0$/, "") + " GB";
  if (mb >= 10) return Math.round(mb) + " MB";
  return mb.toFixed(1).replace(/\.0$/, "") + " MB";
}
