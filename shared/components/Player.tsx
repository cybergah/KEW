// Kew — shared advanced media player (Android & Windows).
// Video + Music library, dedicated now-playing screen, mini bar, resume,
// double-tap gestures, sleep timer, favorites, playlists, sort & grouping.
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Check, Clapperboard, Folder, Heart, ListMusic, ListPlus, LockOpen, Music, Plus, X } from "lucide-react";
import { listMedia, isNative, toPlayableSrc } from "@native";
import type { DownloadRecord } from "../lib/store";
import { AdvancedPlayer } from "./player/AdvancedPlayer";
import { ThumbImg } from "./player/ThumbImg";
import { fmtTime, keyOf, readJson, writeJson, type LibItem, type RepeatMode } from "./player/media";

export { fmtTime, type LibItem } from "./player/media";

/* ---------------- library screen ---------------- */

type SortMode = "date" | "name" | "dur";

export function PlayerScreen({
  t,
  item,
}: {
  t: (k: string) => string;
  item: DownloadRecord | null;
  onOpen?: (d: DownloadRecord) => void;
}) {
  const [mode, setMode] = useState<"video" | "music">(item?.audioOnly ? "music" : "video");
  const [lib, setLib] = useState<LibItem[]>([]);
  const [needPerm, setNeedPerm] = useState(false);
  const [q, setQ] = useState("");
  const [cur, setCur] = useState<LibItem | null>(null);
  const [view, setView] = useState<"list" | "player">("list");
  const [shuf, setShuf] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>(() => readJson<RepeatMode>("kew.repeat", "off"));
  const [sort, setSort] = useState<SortMode>("date");
  const [favOnly, setFavOnly] = useState(false);
  const [favs, setFavs] = useState<string[]>(() => readJson<string[]>("kew.favs", []));
  const [pls, setPls] = useState<Record<string, string[]>>(() => readJson<Record<string, string[]>>("kew.playlists", {}));
  const [activePl, setActivePl] = useState<string | null>(null);
  const [groupField, setGroupField] = useState<"artist" | "album">("artist");
  const [group, setGroup] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<LibItem | null>(null);
  const [newPl, setNewPl] = useState("");

  async function load(m: "video" | "music") {
    if (!isNative()) return;
    try {
      const items = await listMedia(m === "video" ? "video" : "audio");
      setLib(items.map((x) => ({
        title: x.title, src: x.src, path: x.path, duration: x.duration,
        artist: (x as any).artist, album: (x as any).album,
      })));
      setNeedPerm(false);
    } catch {
      setLib([]);
      setNeedPerm(true);
    }
  }
  useEffect(() => {
    load(mode);
    setGroup(null);
    setActivePl(null);
  }, [mode]);

  // A ▶ tap in the Downloads tab opens that file in the dedicated screen.
  useEffect(() => {
    if (item && (item.playUri || item.localUri)) {
      setMode(item.audioOnly ? "music" : "video");
      // toPlayableSrc is idempotent; it upgrades URLs saved by older versions.
      setCur({ title: item.title, src: toPlayableSrc((item.playUri || item.localUri)!), sub: item.subUri && toPlayableSrc(item.subUri) });
      setView("player");
    }
  }, [item]);

  function saveFavs(next: string[]) { setFavs(next); writeJson("kew.favs", next); }
  function savePls(next: Record<string, string[]>) { setPls(next); writeJson("kew.playlists", next); }
  function toggleFav(x: LibItem) {
    const k = keyOf(x);
    saveFavs(favs.includes(k) ? favs.filter((f) => f !== k) : [...favs, k]);
  }
  function togglePl(name: string, x: LibItem) {
    const k = keyOf(x);
    const cu = pls[name] || [];
    savePls({ ...pls, [name]: cu.includes(k) ? cu.filter((p) => p !== k) : [...cu, k] });
  }

  // group values (video: parent folder · music: artist/album)
  const groups = useMemo(() => {
    const set = new Map<string, number>();
    for (const x of lib) {
      const g = mode === "video"
        ? (x.path || "").replace(/[\\/][^\\/]*$/, "").replace(/^.*[\\/]/, "")
        : ((groupField === "artist" ? x.artist : x.album) || "");
      if (!g) continue;
      set.set(g, (set.get(g) || 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 40);
  }, [lib, mode, groupField]);

  const shown = useMemo(() => {
    let list = lib;
    if (activePl && pls[activePl]) {
      const set = new Set(pls[activePl]);
      list = list.filter((x) => set.has(keyOf(x)));
    }
    if (favOnly) {
      const set = new Set(favs);
      list = list.filter((x) => set.has(keyOf(x)));
    }
    if (group) {
      list = list.filter((x) => {
        const g = mode === "video"
          ? (x.path || "").replace(/[\\/][^\\/]*$/, "").replace(/^.*[\\/]/, "")
          : ((groupField === "artist" ? x.artist : x.album) || "");
        return g === group;
      });
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((x) => (x.title + " " + (x.artist || "") + " " + (x.album || "")).toLowerCase().includes(needle));
    }
    if (sort === "name") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "dur") list = [...list].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    return list;
  }, [lib, activePl, pls, favOnly, favs, group, groupField, mode, q, sort]);

  const curIdx = cur ? shown.findIndex((x) => x.src === cur.src) : -1;

  function advance(dir: 1 | -1) {
    if (!shown.length) return;
    if (shuf && shown.length > 1) {
      let i = curIdx;
      while (i === curIdx) i = Math.floor(Math.random() * shown.length);
      setCur(shown[i]);
      return;
    }
    let ni = curIdx + dir;
    // "repeat all" wraps around the list in both directions
    if (repeat === "all") ni = (ni + shown.length) % shown.length;
    if (ni >= 0 && ni < shown.length) setCur(shown[ni]);
  }

  function cycleRepeat() {
    const next: RepeatMode = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    setRepeat(next);
    writeJson("kew.repeat", next);
  }

  const sortLabel = sort === "date" ? t("sort_new") : sort === "name" ? t("sort_name") : t("sort_dur");

  return (
    <>
      <div className="seg mode-seg">
        <button className={mode === "video" ? "on" : ""} onClick={() => { setMode("video"); setCur(null); setView("list"); }}>
          <Clapperboard size={17} /> {t("video")}
        </button>
        <button className={mode === "music" ? "on" : ""} onClick={() => { setMode("music"); setCur(null); setView("list"); }}>
          <Music size={17} /> {t("music")}
        </button>
      </div>

      {cur && (
        <AdvancedPlayer
          key={cur.src}
          kind={mode}
          item={cur}
          full={view === "player"}
          posInfo={curIdx >= 0 ? `${curIdx + 1} / ${shown.length}` : undefined}
          t={t}
          hasPrev={curIdx > 0}
          hasNext={curIdx >= 0 && curIdx < shown.length - 1}
          shuffle={shuf}
          onShuffle={() => setShuf((s) => !s)}
          repeat={repeat}
          onRepeat={cycleRepeat}
          onPrev={() => advance(-1)}
          onNext={() => advance(1)}
          onEnded={() => {
            // music plays on through the list; videos only when looping the list
            if (mode === "music" || repeat === "all") advance(1);
          }}
          onBack={() => setView("list")}
          onExpand={() => setView("player")}
          onClose={() => { setCur(null); setView("list"); }}
        />
      )}

      <div className="dl-tools">
        <input className="url-input" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* filters: sort · favorites · playlists */}
      <div className="chips-row">
        <button className="chip-btn" onClick={() => setSort(sort === "date" ? "name" : sort === "name" ? "dur" : "date")}>
          <ArrowDownUp size={14} /> {sortLabel}
        </button>
        <button className={"chip-btn" + (favOnly ? " on" : "")} onClick={() => setFavOnly((f) => !f)}>
          <Heart size={14} /> {t("favs")}
        </button>
        {Object.keys(pls).map((name) => (
          <button
            key={name}
            className={"chip-btn" + (activePl === name ? " on" : "")}
            onClick={() => setActivePl(activePl === name ? null : name)}
          >
            <ListMusic size={14} /> {name}
          </button>
        ))}
      </div>

      {/* grouping: folders (video) · artist/album (music) */}
      {mode === "music" && (
        <div className="chips-row">
          <button className={"chip-btn" + (groupField === "artist" ? " on" : "")} onClick={() => { setGroupField("artist"); setGroup(null); }}>
            {t("artist")}
          </button>
          <button className={"chip-btn" + (groupField === "album" ? " on" : "")} onClick={() => { setGroupField("album"); setGroup(null); }}>
            {t("album")}
          </button>
        </div>
      )}
      {groups.length > 1 && (
        <div className="chips-row">
          <button className={"chip-btn" + (!group ? " on" : "")} onClick={() => setGroup(null)}>{t("all")}</button>
          {groups.map((g) => (
            <button key={g} className={"chip-btn" + (group === g ? " on" : "")} onClick={() => setGroup(group === g ? null : g)}>
              {mode === "video" && <Folder size={14} />}{g}
            </button>
          ))}
        </div>
      )}

      {needPerm && (
        <div className="card" style={{ textAlign: "center" }}>
          <button className="btn btn-gold" onClick={() => load(mode)}><LockOpen size={18} /> {t("allow_access")}</button>
        </div>
      )}

      {!needPerm && shown.length === 0 && (
        <div className="empty">
          <div className="big">{mode === "video" ? <Clapperboard /> : <Music />}</div>
          <h3>{t("no_media")}</h3>
        </div>
      )}

      {shown.map((x, i) => {
        const k = keyOf(x);
        const isFav = favs.includes(k);
        return (
          <div key={k + i} className={"card lib-item" + (i === curIdx ? " on" : "")} onClick={() => { setCur(x); setView("player"); }}>
            <div className="dl">
              <div className="thumb">
                {mode === "video" ? <ThumbImg path={x.path} fallback={<Clapperboard size={22} />} /> : <Music size={22} />}
              </div>
              <div className="meta">
                <div className="name">{x.title}</div>
                <div className="sub">
                  {x.artist ? x.artist + " · " : ""}
                  {x.duration ? fmtTime(x.duration) : ""}
                </div>
              </div>
              <div className="acts">
                <button
                  className={"icon-btn fav" + (isFav ? " on" : "")}
                  onClick={(e) => { e.stopPropagation(); toggleFav(x); }}
                >
                  <Heart fill={isFav ? "currentColor" : "none"} />
                </button>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setPickFor(x); }}><ListPlus /></button>
              </div>
            </div>
          </div>
        );
      })}

      {/* add-to-playlist picker */}
      {pickFor && (
        <div className="confirm-overlay" onClick={() => setPickFor(null)}>
          <div className="card confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="h-ico" style={{ fontWeight: 700, marginBottom: 10 }}><ListPlus size={18} /> {t("add_to_list")}</div>
            {Object.keys(pls).map((name) => {
              const inPl = (pls[name] || []).includes(keyOf(pickFor));
              return (
                <div key={name} className={"lang-opt" + (inPl ? " on" : "")} style={{ marginBottom: 6 }} onClick={() => togglePl(name, pickFor)}>
                  {inPl ? <Check size={16} /> : <ListMusic size={16} />} {name}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="url-input"
                style={{ padding: "10px 12px", fontSize: 13 }}
                placeholder={t("new_list")}
                value={newPl}
                onChange={(e) => setNewPl(e.target.value)}
              />
              <button
                className="btn btn-gold"
                onClick={() => {
                  const name = newPl.trim();
                  if (!name || pls[name]) return;
                  savePls({ ...pls, [name]: [keyOf(pickFor)] });
                  setNewPl("");
                }}
              >
                <Plus size={18} />
              </button>
            </div>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setPickFor(null)}>
              <X size={18} /> {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
