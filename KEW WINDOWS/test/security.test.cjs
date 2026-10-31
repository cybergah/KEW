// Unit tests for electron/security.cjs — run with `npm test` (plain Node).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const sec = require("../electron/security.cjs");

test("httpUrl only accepts http(s) URLs", () => {
  assert.equal(sec.httpUrl(" https://youtu.be/abc "), "https://youtu.be/abc");
  assert.equal(sec.httpUrl("http://example.com"), "http://example.com/");
  for (const bad of ["--exec calc", "-o x", "file:///C:/Windows/notepad.exe", "javascript:alert(1)", "ftp://a/b", "", null, undefined, 42]) {
    assert.equal(sec.httpUrl(bad), null, String(bad));
  }
});

test("searchTarget builds a bounded ytsearch / scsearch target", () => {
  assert.equal(sec.searchTarget("  tarkan  şımarık ", 5), "ytsearch5:tarkan şımarık");
  assert.equal(sec.searchTarget("a\nb\u0000c"), "ytsearch12:a b c");
  assert.equal(sec.searchTarget("x", 999), "ytsearch30:x");
  assert.equal(sec.searchTarget("x", 6, "sc"), "scsearch6:x");
  assert.equal(sec.searchTarget("x", 6, "evil"), "ytsearch6:x");
  assert.equal(sec.searchTarget("--exec calc", 3), "ytsearch3:--exec calc");
  assert.equal(sec.searchTarget("x".repeat(500)).length, "ytsearch12:".length + 200);
  for (const bad of ["", "   ", null, undefined]) assert.equal(sec.searchTarget(bad), null, String(bad));
});

test("clip times parse strictly and build a download-sections spec", () => {
  assert.equal(sec.parseTime("90"), 90);
  assert.equal(sec.parseTime("1:30"), 90);
  assert.equal(sec.parseTime("01:02:03"), 3723);
  assert.equal(sec.parseTime("75.5"), 75.5);
  for (const bad of ["", "1:75", "abc", "-5", "1:2:3:4", "1;rm -rf", null]) assert.equal(sec.parseTime(bad), null, String(bad));
  assert.equal(sec.clipSpec({ start: "0:30", end: "1:45" }), "*30-105");
  assert.equal(sec.clipSpec({ start: "2:00", end: "1:00" }), null);
  assert.equal(sec.clipSpec({ start: "x", end: "1:00" }), null);
  assert.equal(sec.clipSpec(null), null);
});

test("qualitiesOf lists one size per height, H.264 first, plus audio", () => {
  const info = {
    duration: 100,
    formats: [
      { format_id: "140", vcodec: "none", acodec: "mp4a.40.2", filesize: 1000 },
      { format_id: "251", vcodec: "none", acodec: "opus", filesize: 900, abr: 160 },
      { format_id: "137", height: 1080, vcodec: "avc1.640028", acodec: "none", filesize: 50000 },
      { format_id: "248", height: 1080, vcodec: "vp9", acodec: "none", filesize: 30000 },
      { format_id: "136", height: 720, vcodec: "avc1.4d401f", acodec: "none", filesize_approx: 20000 },
      { format_id: "18", height: 360, vcodec: "avc1.42001E", acodec: "mp4a.40.2", tbr: 8 },
      { format_id: "sb0", height: 90, vcodec: "none", acodec: "none" },
    ],
  };
  const r = sec.qualitiesOf(info);
  assert.equal(r.audioSize, 1000);
  assert.deepEqual(r.qualities, [
    { height: 1080, size: 51000 },
    { height: 720, size: 21000 },
    { height: 360, size: 100000 },
  ]);
  assert.deepEqual(sec.qualitiesOf({}).qualities, []);
});

test("only extension origins may use the detection server", () => {
  assert.ok(sec.isAllowedOrigin(undefined));
  assert.ok(sec.isAllowedOrigin("chrome-extension://abcdefghijklmnop"));
  assert.ok(sec.isAllowedOrigin("moz-extension://1b2c3d4e-0000-1111-2222-333344445555"));
  for (const bad of ["https://evil.example", "http://127.0.0.1:48155", "null", "file://", "chrome-extension://x/../y"]) {
    assert.equal(sec.isAllowedOrigin(bad), false, bad);
  }
});

test("detection server requires the loopback Host header", () => {
  assert.ok(sec.isLoopbackHost("127.0.0.1:48155", 48155));
  assert.ok(sec.isLoopbackHost("localhost:48155", 48155));
  assert.equal(sec.isLoopbackHost("evil.example:48155", 48155), false);
  assert.equal(sec.isLoopbackHost(undefined, 48155), false);
});

test("parseRange", () => {
  assert.equal(sec.parseRange(undefined, 100), null);
  assert.deepEqual(sec.parseRange("bytes=0-", 100), { start: 0, end: 99 });
  assert.deepEqual(sec.parseRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(sec.parseRange("bytes=90-500", 100), { start: 90, end: 99 });
  assert.deepEqual(sec.parseRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.equal(sec.parseRange("bytes=100-", 100), "invalid");
  assert.equal(sec.parseRange("bytes=20-10", 100), "invalid");
  assert.equal(sec.parseRange("bytes=-0", 100), "invalid");
  assert.equal(sec.parseRange("items=0-1", 100), null);
});

test("resolveAllowed keeps files inside the media folders", (t) => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "kew-sec-")));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, "Downloads", "Kew");
  const outside = path.join(tmp, "Secret");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(outside);
  const video = path.join(root, "clip [abc].mp4");
  const exe = path.join(root, "setup.exe");
  const secret = path.join(outside, "private.mp4");
  for (const f of [video, exe, secret]) fs.writeFileSync(f, "x");
  const roots = [root];

  // plain path, file:// URI and kew-media:// URL all resolve
  assert.equal(sec.resolveAllowed(video, roots, sec.MEDIA_EXT), video);
  assert.equal(sec.resolveAllowed(pathToFileURL(video).href, roots, sec.MEDIA_EXT), video);
  assert.equal(sec.resolveAllowed(sec.mediaUrl(video), roots, sec.MEDIA_EXT), video);

  // wrong type, outside the roots, traversal, missing, the root itself
  assert.equal(sec.resolveAllowed(exe, roots, sec.MEDIA_EXT), null);
  assert.equal(sec.resolveAllowed(secret, roots, sec.MEDIA_EXT), null);
  assert.equal(sec.resolveAllowed(path.join(root, "..", "..", "Secret", "private.mp4"), roots, sec.MEDIA_EXT), null);
  assert.equal(sec.resolveAllowed(path.join(root, "nope.mp4"), roots, sec.MEDIA_EXT), null);
  assert.equal(sec.resolveAllowed(root, roots, sec.MEDIA_EXT), null);
  assert.equal(sec.resolveAllowed("relative.mp4", roots, sec.MEDIA_EXT), null);
  assert.equal(sec.resolveAllowed("kew-media://other/" + encodeURIComponent(video), roots, sec.MEDIA_EXT), null);

  // a symlink inside the root that points outside is refused
  const link = path.join(root, "link.mp4");
  try {
    fs.symlinkSync(secret, link);
  } catch {
    return; // symlinks need extra rights on Windows; skip that part
  }
  assert.equal(sec.resolveAllowed(link, roots, sec.MEDIA_EXT), null);
});

test("mimeOf", () => {
  assert.equal(sec.mimeOf("a.MP4"), "video/mp4");
  assert.equal(sec.mimeOf("a.vtt"), "text/vtt; charset=utf-8");
  assert.equal(sec.mimeOf("a.exe"), "application/octet-stream");
});
