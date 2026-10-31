// Kew for Windows — security checks used by the main process. Kept free of
// Electron imports so they can be unit-tested with plain Node
// (`node --test electron/`). Cybergah Group · GPL-3.0
const path = require("path");
const fs = require("fs");
const { fileURLToPath } = require("url");

// ---- URLs handed to yt-dlp ----

/**
 * Normalized http(s) URL, or null. Everything yt-dlp receives as the target
 * goes through this (and after a "--"), so text like "--exec calc" can never
 * be read as an option.
 */
function httpUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Free-text search → a yt-dlp "ytsearchN:" / "scsearchN:" (SoundCloud) target,
 *  or null. Control chars are stripped and the length capped; the prefix means
 *  it can never be parsed as an option. */
const SEARCH_MAX = 30;
const SEARCH_PREFIX = { yt: "ytsearch", sc: "scsearch" };
function searchTarget(raw, n, source) {
  const q = String(raw == null ? "" : raw).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!q) return null;
  const count = Math.min(Math.max(parseInt(n, 10) || 12, 1), SEARCH_MAX);
  return `${SEARCH_PREFIX[source] || SEARCH_PREFIX.yt}${count}:${q}`;
}

/** "90", "1:30", "01:02:03", "75.5" → seconds (or null). */
function parseTime(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!/^\d{1,3}(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** A clip [start, end] → yt-dlp "--download-sections" spec ("*S-E"), or null
 *  when it is missing / invalid (then the whole video is downloaded). */
function clipSpec(clip) {
  if (!clip || typeof clip !== "object") return null;
  const a = parseTime(clip.start), b = parseTime(clip.end);
  if (a == null || b == null || b <= a) return null;
  return `*${a}-${b}`;
}

/** Real video qualities from a yt-dlp info dict: one entry per height, with
 *  the size of the stream Kew would actually pick (H.264 preferred, as the
 *  download's "-S" sort does) plus the best audio track. Highest first. */
function qualitiesOf(info) {
  const fmts = Array.isArray(info && info.formats) ? info.formats : [];
  const dur = Number(info && info.duration) || 0;
  const sizeOf = (f) => f.filesize || f.filesize_approx || (f.tbr && dur ? Math.round(f.tbr * 125 * dur) : 0);
  const audio = fmts
    .filter((f) => f.vcodec === "none" && f.acodec && f.acodec !== "none")
    .sort((x, y) => (/^mp4a/.test(y.acodec) - /^mp4a/.test(x.acodec)) || ((y.abr || y.tbr || 0) - (x.abr || x.tbr || 0)))[0];
  const audioSize = audio ? sizeOf(audio) : 0;
  const byHeight = new Map();
  for (const f of fmts) {
    if (!f.height || !f.vcodec || f.vcodec === "none") continue;
    const h264 = /^avc1|^h264/.test(f.vcodec);
    const cur = byHeight.get(f.height);
    const better = !cur || (h264 && !cur.h264) || (h264 === cur.h264 && sizeOf(f) > cur.size);
    if (better) byHeight.set(f.height, { h264, size: sizeOf(f), muxed: f.acodec && f.acodec !== "none" });
  }
  const list = [...byHeight.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([height, v]) => ({ height, size: v.size ? v.size + (v.muxed ? 0 : audioSize) : 0 }));
  return { qualities: list, audioSize };
}

// ---- local detection server (browser extension → Kew) ----

const EXTENSION_ORIGIN_RE = /^(chrome-extension|moz-extension|safari-web-extension|ms-browser-extension):\/\/[a-z0-9._-]+$/i;

/**
 * Only the Kew Companion extension may talk to the local server. Web pages
 * always send an http(s) (or "null") Origin on a cross-site POST, so they are
 * refused; extension background requests carry their extension origin (or
 * none at all in some Firefox versions).
 */
function isAllowedOrigin(origin) {
  if (origin === undefined || origin === "") return true;
  return EXTENSION_ORIGIN_RE.test(String(origin));
}

/** Blocks DNS-rebinding: the request must be addressed to the loopback port itself. */
function isLoopbackHost(host, port) {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

// ---- local media files (player + "open with system player") ----

const VIDEO_EXT = ["mp4", "mkv", "webm", "mov", "avi", "m4v"];
const AUDIO_EXT = ["mp3", "m4a", "opus", "ogg", "wav", "flac", "aac"];
const SUB_EXT = ["vtt", "srt"];
const MEDIA_EXT = new Set([...VIDEO_EXT, ...AUDIO_EXT]);
const PLAYABLE_EXT = new Set([...VIDEO_EXT, ...AUDIO_EXT, ...SUB_EXT]);

const MIME = {
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
  mov: "video/quicktime", avi: "video/x-msvideo",
  mp3: "audio/mpeg", m4a: "audio/mp4", opus: "audio/ogg", ogg: "audio/ogg",
  wav: "audio/wav", flac: "audio/flac", aac: "audio/aac",
  vtt: "text/vtt; charset=utf-8", srt: "text/plain; charset=utf-8",
};

const extOf = (fp) => path.extname(fp).slice(1).toLowerCase();
const mimeOf = (fp) => MIME[extOf(fp)] || "application/octet-stream";

const MEDIA_SCHEME = "kew-media";
const MEDIA_HOST = "media";

/** file path → URL served by the kew-media:// protocol handler. */
function mediaUrl(fp) {
  return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encodeURIComponent(fp)}`;
}

/** file:// URI, kew-media:// URL or plain path → absolute path (unchecked), or null. */
function toPath(raw) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    if (raw.startsWith("file:")) return fileURLToPath(raw);
    if (raw.startsWith(MEDIA_SCHEME + ":")) {
      const u = new URL(raw);
      return u.hostname === MEDIA_HOST ? decodeURIComponent(u.pathname.slice(1)) : null;
    }
  } catch {
    return null;
  }
  return path.isAbsolute(raw) ? raw : null;
}

function isInside(root, fp) {
  const rel = path.relative(root, fp);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Resolve `raw` to a real file under one of `roots` whose extension is in
 * `exts`, or null. Symlinks/junctions are resolved first so they can't point
 * outside the allowed folders.
 */
function resolveAllowed(raw, roots, exts) {
  const fp = toPath(raw);
  if (!fp || !exts.has(extOf(fp))) return null;
  let real;
  try {
    real = fs.realpathSync(fp);
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  const ok = roots.some((r) => {
    let rr;
    try { rr = fs.realpathSync(r); } catch { return false; }
    return isInside(rr, real);
  });
  return ok && exts.has(extOf(real)) ? real : null;
}

/**
 * Byte range for a `Range: bytes=a-b` header (video seeking).
 * Returns null when there is no usable header (serve the whole file) and
 * "invalid" when it can't be satisfied (416).
 */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start, end;
  if (m[1] === "") {
    // suffix range: last N bytes
    const n = Number(m[2]);
    if (n === 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

module.exports = {
  httpUrl,
  searchTarget,
  parseTime,
  clipSpec,
  qualitiesOf,
  isAllowedOrigin,
  isLoopbackHost,
  MEDIA_EXT,
  PLAYABLE_EXT,
  MEDIA_SCHEME,
  MEDIA_HOST,
  mediaUrl,
  mimeOf,
  toPath,
  resolveAllowed,
  parseRange,
};
