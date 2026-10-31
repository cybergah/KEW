// Kew player — shared helpers: library item type, time format, and tiny
// localStorage stores (resume positions, favorites, playlists).

export type LibItem = {
  title: string;
  src: string;
  path?: string;
  duration?: number;
  artist?: string;
  album?: string;
  sub?: string;
};

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return (h > 0 ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + ss;
}

export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const SLEEPS = [0, 15, 30, 60, 90]; // minutes

/* ---------- tiny localStorage stores (positions, favorites, playlists) ---------- */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

type PosEntry = [string, number, number]; // src, seconds, savedAt
export function posGet(src: string): number {
  const list = readJson<PosEntry[]>("kew.positions", []);
  const e = list.find((x) => x[0] === src);
  return e ? e[1] : 0;
}
export function posSet(src: string, sec: number) {
  let list = readJson<PosEntry[]>("kew.positions", []).filter((x) => x[0] !== src);
  list.push([src, sec, Date.now()]);
  if (list.length > 600) list = list.sort((a, b) => b[2] - a[2]).slice(0, 600);
  writeJson("kew.positions", list);
}
export function posClear(src: string) {
  writeJson("kew.positions", readJson<PosEntry[]>("kew.positions", []).filter((x) => x[0] !== src));
}

export function keyOf(x: LibItem) {
  return x.path || x.src;
}

export type RepeatMode = "off" | "all" | "one";
