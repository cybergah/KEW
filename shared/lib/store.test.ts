import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the platform key/value bridge.
const kv = new Map<string, string>();
vi.mock("@native", () => ({
  kvGet: async (k: string) => kv.get(k) ?? null,
  kvSet: async (k: string, v: string) => void kv.set(k, v),
  migrateSettings: <T>(s: T) => s,
}));

import {
  createSaver,
  DEFAULT_SETTINGS,
  loadDownloads,
  loadSettings,
  normalizeLoaded,
  saveDownloads,
  trimHistory,
  type DownloadRecord,
} from "./store";

const rec = (id: string, status: DownloadRecord["status"]): DownloadRecord => ({
  id,
  managerId: -1,
  url: `https://youtu.be/${id}`,
  filename: id,
  title: id,
  platform: "youtube",
  audioOnly: false,
  createdAt: 0,
  status,
});

beforeEach(() => kv.clear());

describe("settings", () => {
  it("returns defaults when nothing is saved", async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges saved values over defaults and drops the old Cobalt server", async () => {
    kv.set("kew.settings", JSON.stringify({ lang: "tr", server: "https://co.example", concurrent: 3 }));
    const s = await loadSettings();
    expect(s.lang).toBe("tr");
    expect(s.concurrent).toBe(3);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
    expect("server" in s).toBe(false);
  });

  it("survives corrupt JSON", async () => {
    kv.set("kew.settings", "{nope");
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("history", () => {
  it("turns running/queued items into paused on load", async () => {
    kv.set("kew.downloads", JSON.stringify([rec("a", "running"), rec("b", "queued"), rec("c", "completed"), rec("d", "failed")]));
    const list = await loadDownloads();
    expect(list.map((d) => d.status)).toEqual(["paused", "paused", "completed", "failed"]);
  });

  it("ignores non-array data", () => {
    expect(normalizeLoaded({} as any)).toEqual([]);
  });

  it("keeps all active items and only the newest finished ones", () => {
    const list = [rec("p", "paused"), rec("c1", "completed"), rec("f1", "failed"), rec("q", "queued"), rec("c2", "completed")];
    expect(trimHistory(list, 2).map((d) => d.id)).toEqual(["p", "c1", "f1", "q"]);
  });

  it("trims on save", async () => {
    const list = Array.from({ length: 600 }, (_, i) => rec(String(i), "completed"));
    await saveDownloads(list);
    expect(JSON.parse(kv.get("kew.downloads")!)).toHaveLength(500);
  });
});

describe("createSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes only the latest list once things settle", () => {
    const write = vi.fn();
    const s = createSaver(write, 1000);
    s.schedule([rec("a", "running")]);
    vi.advanceTimersByTime(500);
    s.schedule([rec("b", "running")]);
    vi.advanceTimersByTime(999);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0][0].id).toBe("b");
  });

  it("flush writes immediately, and only once", () => {
    const write = vi.fn();
    const s = createSaver(write, 1000);
    s.schedule([rec("a", "running")]);
    s.flush();
    s.flush();
    vi.advanceTimersByTime(2000);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
