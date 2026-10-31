import { describe, expect, it } from "vitest";
import { downloadedKeys, findDownloaded, fmtClock, fmtSize, parseTime, urlKey, validClip } from "./media";
import type { DownloadRecord } from "./store";

const rec = (p: Partial<DownloadRecord>): DownloadRecord => ({
  id: "1", managerId: -1, url: "", filename: "", title: "", platform: "youtube",
  audioOnly: false, createdAt: 0, status: "completed", ...p,
});

describe("urlKey", () => {
  it("treats every YouTube link form of one video as the same", () => {
    const k = "yt:cpp69ghR1IM";
    for (const u of [
      "https://www.youtube.com/watch?v=cpp69ghR1IM",
      "https://youtu.be/cpp69ghR1IM?si=abc",
      "https://m.youtube.com/watch?v=cpp69ghR1IM&t=30",
      "https://music.youtube.com/watch?v=cpp69ghR1IM&feature=share",
      "https://www.youtube.com/shorts/cpp69ghR1IM",
    ]) expect(urlKey(u)).toBe(k);
  });
  it("normalises other sites (tracking params, trailing slash)", () => {
    expect(urlKey("https://www.tiktok.com/@a/video/123/?utm_source=x")).toBe("tiktok.com/@a/video/123");
    expect(urlKey("https://vimeo.com/42")).not.toBe(urlKey("https://vimeo.com/43"));
  });
});

describe("findDownloaded", () => {
  const list = [
    rec({ url: "https://youtu.be/cpp69ghR1IM", audioOnly: true }),
    rec({ url: "https://vimeo.com/42", status: "failed" }),
    rec({ url: "https://youtu.be/AAAAAAAAAAA", clip: { start: "0:10", end: "0:20" } }),
  ];
  it("matches the same video in the same mode only", () => {
    expect(findDownloaded(list, "https://www.youtube.com/watch?v=cpp69ghR1IM", true)).toBeTruthy();
    expect(findDownloaded(list, "https://www.youtube.com/watch?v=cpp69ghR1IM", false)).toBeUndefined();
  });
  it("ignores failed downloads and clips", () => {
    expect(findDownloaded(list, "https://vimeo.com/42", false)).toBeUndefined();
    expect(findDownloaded(list, "https://youtu.be/AAAAAAAAAAA", false)).toBeUndefined();
  });
  it("collects keys for badges", () => {
    expect(downloadedKeys(list).has("yt:cpp69ghR1IM")).toBe(true);
  });
});

describe("clip times", () => {
  it("parses like the engines do", () => {
    expect(parseTime("90")).toBe(90);
    expect(parseTime("1:30")).toBe(90);
    expect(parseTime("01:02:03")).toBe(3723);
    expect(parseTime("1:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });
  it("validates ranges", () => {
    expect(validClip("0:30", "1:00")).toBe(true);
    expect(validClip("1:00", "0:30")).toBe(false);
    expect(validClip("5:00", "6:00", 200)).toBe(false);
  });
  it("formats clocks and sizes", () => {
    expect(fmtClock(75)).toBe("1:15");
    expect(fmtClock(3723)).toBe("1:02:03");
    expect(fmtSize(84_200_000)).toBe("84 MB");
    expect(fmtSize(3_100_000)).toBe("3.1 MB");
    expect(fmtSize(1_400_000_000)).toBe("1.4 GB");
    expect(fmtSize(0)).toBe("");
  });
});
