import { describe, expect, it } from "vitest";
import { detect, isValidUrl } from "./platform";

describe("detect", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://youtu.be/abc", "youtube"],
    ["https://x.com/user/status/1", "x"],
    ["https://vm.tiktok.com/xyz/", "tiktok"],
    ["https://www.instagram.com/reel/abc/", "instagram"],
    ["https://fb.watch/abc/", "facebook"],
    ["https://vimeo.com/123", "vimeo"],
    ["https://www.twitch.tv/videos/1", "twitch"],
    ["https://redd.it/abc", "reddit"],
    ["https://soundcloud.com/a/b", "soundcloud"],
    ["https://pin.it/abc", "pinterest"],
    ["https://b23.tv/abc", "bilibili"],
    ["https://example.com/video.mp4", "unknown"],
  ])("%s → %s", (url, platform) => {
    expect(detect(url).platform).toBe(platform);
  });

  it("detects playlists per platform", () => {
    expect(detect("https://www.youtube.com/watch?v=a&list=PL1").isPlaylist).toBe(true);
    expect(detect("https://www.youtube.com/playlist?list=PL1").isPlaylist).toBe(true);
    expect(detect("https://www.youtube.com/watch?v=a").isPlaylist).toBe(false);
    expect(detect("https://soundcloud.com/artist/sets/album").isPlaylist).toBe(true);
    expect(detect("https://vimeo.com/showcase/123").isPlaylist).toBe(true);
    expect(detect("https://www.dailymotion.com/playlist/x1").isPlaylist).toBe(true);
  });

  it("trims whitespace", () => {
    expect(detect("  https://youtu.be/abc \n").url).toBe("https://youtu.be/abc");
  });
});

describe("isValidUrl", () => {
  it("accepts http(s) only", () => {
    expect(isValidUrl("https://youtu.be/abc")).toBe(true);
    expect(isValidUrl(" http://example.com ")).toBe(true);
    expect(isValidUrl("ftp://example.com/a")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("--exec calc")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});
