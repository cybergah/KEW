import { describe, expect, it } from "vitest";
import { filterDownloads, groupBatches, humanError, platformsIn } from "./downloads";
import type { DownloadRecord } from "./store";

const rec = (id: string, p: Partial<DownloadRecord> = {}): DownloadRecord => ({
  id,
  managerId: -1,
  url: `https://example.com/${id}`,
  filename: id,
  title: id,
  platform: "youtube",
  audioOnly: false,
  createdAt: 0,
  status: "completed",
  ...p,
});

const list = [
  rec("Song One", { audioOnly: true, platform: "soundcloud" }),
  rec("Clip Two", { status: "running" }),
  rec("Clip Three", { status: "failed", platform: "tiktok" }),
  rec("Movie Four", { status: "paused" }),
];

const ids = (l: DownloadRecord[]) => l.map((d) => d.id);

describe("filterDownloads", () => {
  it("searches titles case-insensitively", () => {
    expect(ids(filterDownloads(list, { q: " clip ", kind: "all", platform: "all" }))).toEqual(["Clip Two", "Clip Three"]);
  });

  it("filters by kind", () => {
    expect(ids(filterDownloads(list, { q: "", kind: "audio", platform: "all" }))).toEqual(["Song One"]);
    expect(ids(filterDownloads(list, { q: "", kind: "video", platform: "all" }))).toHaveLength(3);
    expect(ids(filterDownloads(list, { q: "", kind: "active", platform: "all" }))).toEqual(["Clip Two", "Movie Four"]);
    expect(ids(filterDownloads(list, { q: "", kind: "failed", platform: "all" }))).toEqual(["Clip Three"]);
  });

  it("filters by platform and combines filters", () => {
    expect(ids(filterDownloads(list, { q: "", kind: "all", platform: "tiktok" }))).toEqual(["Clip Three"]);
    expect(ids(filterDownloads(list, { q: "clip", kind: "active", platform: "youtube" }))).toEqual(["Clip Two"]);
  });
});

describe("platformsIn", () => {
  it("orders by frequency", () => {
    expect(platformsIn(list)).toEqual(["youtube", "soundcloud", "tiktok"]);
  });
});

describe("groupBatches", () => {
  it("groups contiguous items of the same playlist", () => {
    const l = [rec("a", { batchId: "B" }), rec("b", { batchId: "B" }), rec("c"), rec("d", { batchId: "B" })];
    expect(groupBatches(l).map((g) => [g.batchId, ids(g.items)])).toEqual([
      ["B", ["a", "b"]],
      [undefined, ["c"]],
      ["B", ["d"]],
    ]);
  });
});

describe("humanError", () => {
  const t = (k: string) => `<${k}>`;
  it.each([
    ["ERROR: [youtube] abc: Private video. Sign in", "<err_private>"],
    ["Sign in to confirm your age", "<err_age>"],
    ["The uploader has not made this video available in your country", "<err_geo>"],
    ["Video unavailable", "<err_unavailable>"],
    ["Unsupported URL: https://x", "<err_unsupported>"],
    ["urlopen error timed out", "<err_network>"],
  ])("%s", (raw, out) => {
    expect(humanError(raw, t)).toBe(out);
  });

  it("passes unknown errors through", () => {
    expect(humanError("weird", t)).toBe("weird");
    expect(humanError(undefined, t)).toBeUndefined();
  });
});
