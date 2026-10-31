// Kew — pure helpers for the Downloads list (filtering, grouping, errors).

import type { Platform } from "./platform";
import type { DownloadRecord } from "./store";

export type KindFilter = "all" | "video" | "audio" | "active" | "failed";

export interface ListFilter {
  q: string;
  kind: KindFilter;
  platform: Platform | "all";
}

export const isActive = (d: DownloadRecord) =>
  d.status === "running" || d.status === "queued" || d.status === "paused";

export function filterDownloads(list: DownloadRecord[], f: ListFilter): DownloadRecord[] {
  const q = f.q.trim().toLowerCase();
  return list.filter((d) => {
    if (q && !(d.title || d.filename || "").toLowerCase().includes(q)) return false;
    if (f.platform !== "all" && d.platform !== f.platform) return false;
    switch (f.kind) {
      case "video":
        return !d.audioOnly;
      case "audio":
        return d.audioOnly;
      case "active":
        return isActive(d);
      case "failed":
        return d.status === "failed";
      default:
        return true;
    }
  });
}

/** Platforms present in the list, most frequent first. */
export function platformsIn(list: DownloadRecord[]): Platform[] {
  const n = new Map<Platform, number>();
  for (const d of list) n.set(d.platform, (n.get(d.platform) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

/** Group contiguous items of the same playlist batch. */
export function groupBatches(list: DownloadRecord[]): { batchId?: string; items: DownloadRecord[] }[] {
  const groups: { batchId?: string; items: DownloadRecord[] }[] = [];
  for (const d of list) {
    const last = groups[groups.length - 1];
    if (d.batchId && last && last.batchId === d.batchId) last.items.push(d);
    else groups.push({ batchId: d.batchId, items: [d] });
  }
  return groups;
}

/** Map raw yt-dlp error text to a translated, human-friendly message. */
export function humanError(raw: string | undefined, t: (k: string) => string): string | undefined {
  if (!raw) return raw;
  const s = raw.toLowerCase();
  if (/private video|this video is private/.test(s)) return t("err_private");
  if (/confirm your age|age.restrict/.test(s)) return t("err_age");
  if (/available in your country|geo.?restrict|blocked it in your country/.test(s)) return t("err_geo");
  if (/video unavailable|has been removed|does not exist|account.+terminated|no longer available/.test(s)) return t("err_unavailable");
  if (/copyright/.test(s)) return t("err_copyright");
  if (/is live|live event|premiere/.test(s)) return t("err_live");
  if (/unsupported url|is not a valid url|unable to extract|no video formats/.test(s)) return t("err_unsupported");
  if (/network|timed? out|getaddrinfo|connection|ssl|resolve host|urlopen/.test(s)) return t("err_network");
  return raw;
}
