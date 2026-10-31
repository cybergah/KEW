import { useEffect, useState, type ReactNode } from "react";
import { videoThumb } from "@native";

/* ---------------- lazy video thumbnail ---------------- */

const thumbCache = new Map<string, string | null>();

export function ThumbImg({ path, fallback }: { path?: string; fallback: ReactNode }) {
  const [src, setSrc] = useState<string | null>(path ? thumbCache.get(path) ?? null : null);
  useEffect(() => {
    let dead = false;
    if (!path || thumbCache.has(path)) return;
    videoThumb(path).then((s) => {
      thumbCache.set(path, s);
      if (!dead) setSrc(s);
    });
    return () => { dead = true; };
  }, [path]);
  if (src) return <img className="thumb-img" src={src} alt="" />;
  return <>{fallback}</>;
}
