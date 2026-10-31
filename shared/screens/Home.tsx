import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AudioLines, Captions, Check, CheckCheck, CircleCheck, ClipboardPaste, Download, FolderDown, ListVideo, LoaderCircle, Music, Plus, Scissors, Search, Square, SquareCheck, Video, X } from "lucide-react";
import { PlatformIcon } from "../components/PlatformIcon";
import { KewLogo } from "../assets/Logo";
import type { TFn } from "../lib/i18n";
import { detect, isValidUrl, PLATFORM_META, type Platform } from "../lib/platform";
import type { AudioFormat, Settings } from "../lib/store";
import { sfx } from "../lib/sfx";
import { fmtClock, fmtSize, urlKey, validClip } from "../lib/media";
import {
  getSaveFolder, isNative, readClipboardText, ytdlpInfo, ytdlpPlaylist, ytdlpSearch,
  type Clip, type MediaInfo, type PlaylistEntry, type SearchResult, type SearchSource,
} from "@native";

const PAGE = 6; // search results per "page"

export interface DownloadRequest {
  url: string;
  platform: Platform;
  audioOnly: boolean;
  audioFormat?: string;
  subLang?: string;
  quality: string;
  info?: MediaInfo | null;
  isPlaylist?: boolean;
  /** stay on Home (picked from search results) instead of jumping to Downloads */
  stay?: boolean;
  /** playlist items the user picked (skips enumerating it again) */
  entries?: PlaylistEntry[];
  playlistTitle?: string;
  /** download only this part */
  clip?: Clip;
  /** skip the "already downloaded" check */
  force?: boolean;
}

export const SUB_LANGS = ["tr", "ku", "en", "ar", "fa"];

export function HomeScreen({
  t,
  settings,
  onDownload,
  flash,
  downloaded,
}: {
  t: TFn;
  settings: Settings;
  onDownload: (opts: DownloadRequest) => void;
  flash: (m: string) => void;
  /** urlKey()s of finished downloads, for "downloaded" badges */
  downloaded: Set<string>;
}) {
  const [url, setUrl] = useState("");
  const [audioOnly, setAudioOnly] = useState(settings.audioOnly);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(settings.audioFormat);
  const [subs, setSubs] = useState(settings.subs);
  const [subLang, setSubLang] = useState(settings.subLang);
  const [quality, setQuality] = useState(settings.quality);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<Record<string, true>>({});
  const [source, setSource] = useState<SearchSource>("yt");
  const [limit, setLimit] = useState(PAGE);
  const [moreLoading, setMoreLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [clipOn, setClipOn] = useState(false);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [picker, setPicker] = useState<{ loading: boolean; title?: string; entries: PlaylistEntry[]; sel: Set<number> } | null>(null);
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    getSaveFolder().then((f) => setFolder(f && f.custom ? f.path : null)).catch(() => {});
  }, []);

  const isUrl = isValidUrl(url);
  // A single word with a dot and a slash is almost certainly a mistyped link, not a search.
  const looksLikeLink = !isUrl && /^\S*\.\S*\/\S*$/.test(url.trim());
  const det = url && isUrl ? detect(url) : null;
  const meta = det ? PLATFORM_META[det.platform] : null;

  // Fetch a preview (title + thumbnail + real qualities) shortly after a valid link is entered.
  useEffect(() => {
    setInfo(null);
    setPicker(null);
    setClipOn(false);
    if (!isNative() || !url.trim() || !isValidUrl(url) || det?.platform === "unknown") {
      setInfoLoading(false);
      return;
    }
    let cancelled = false;
    setInfoLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const i = await ytdlpInfo(url.trim());
        if (!cancelled) setInfo(i);
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [url]);

  const fmtDur = (s?: number) => (s && s > 0 ? fmtClock(s) : "");

  // Real qualities from the link (highest first), else the usual presets.
  const qualities = useMemo(() => {
    const qs = (info?.qualities || []).filter((q) => q.height >= 144);
    if (!qs.length) return null;
    const pick = qs.slice(0, 5);
    return pick.map((q) => ({ key: String(q.height), label: q.height + "p", size: fmtSize(q.size) }));
  }, [info]);
  const sizeHint = useMemo(() => {
    if (!info) return "";
    if (audioOnly) {
      if (audioFormat === "mp3") return info.duration ? fmtSize(info.duration * 30_000) : ""; // ~240 kbps VBR
      return fmtSize(info.audioSize);
    }
    const qs = info.qualities || [];
    const q = quality === "max" ? qs[0] : qs.find((x) => x.height <= Number(quality));
    return fmtSize(q?.size);
  }, [info, audioOnly, audioFormat, quality]);

  async function paste() {
    const txt = await readClipboardText();
    if (txt.trim()) setUrl(txt.trim());
    else flash(t("paste_first"));
  }

  async function search(src: SearchSource = source) {
    const q = url.trim();
    setSearching(true);
    setResults(null);
    setLimit(PAGE);
    setLastQuery(q);
    try {
      const found = await ytdlpSearch(q, PAGE, src);
      setResults(found);
      (found.length ? sfx.found : sfx.error)();
    } catch {
      setResults([]);
      sfx.error();
      flash(t("search_fail"));
    } finally {
      setSearching(false);
    }
  }

  // "Show more": ask for the next page (yt-dlp returns the first N, so the
  // list grows in place and already-shown rows stay put).
  async function more() {
    const next = limit + PAGE;
    setMoreLoading(true);
    try {
      const found = await ytdlpSearch(lastQuery, next, source);
      setResults(found);
      setLimit(next);
    } catch {
      flash(t("search_fail"));
    } finally {
      setMoreLoading(false);
    }
  }

  function switchSource(src: SearchSource) {
    if (src === source) return;
    setSource(src);
    if (lastQuery || (url.trim() && !isUrl)) void search(src);
  }

  function pick(r: SearchResult, audio: boolean) {
    onDownload({
      url: r.url, platform: source === "sc" ? "soundcloud" : "youtube", audioOnly: audio, audioFormat: audio ? "mp3" : audioFormat,
      subLang: subs && !audio ? subLang : undefined, quality,
      info: { title: r.title, thumbnail: r.thumbnail, duration: r.duration, uploader: r.uploader }, stay: true,
    });
    setAdded((a) => ({ ...a, [r.url + (audio ? "#a" : "#v")]: true }));
  }

  // Playlist: list its videos first so the user can pick which ones to get.
  async function openPicker() {
    setPicker({ loading: true, entries: [], sel: new Set() });
    try {
      const r = await ytdlpPlaylist(url.trim());
      const entries = r.entries || [];
      if (entries.length <= 1) {
        setPicker(null);
        return start(false);
      }
      // already-downloaded videos start unticked
      const sel = new Set(entries.map((_, i) => i).filter((i) => !downloaded.has(urlKey(entries[i].url))));
      setPicker({ loading: false, title: r.title, entries, sel });
    } catch {
      setPicker(null);
      start(false);
    }
  }

  function toggleSel(i: number) {
    setPicker((p) => {
      if (!p) return p;
      const sel = new Set(p.sel);
      if (sel.has(i)) sel.delete(i);
      else sel.add(i);
      return { ...p, sel };
    });
  }

  function start(fromPicker: boolean) {
    const clip = clipOn && !det?.isPlaylist ? { start: clipStart.trim(), end: clipEnd.trim() } : undefined;
    if (clip && !validClip(clip.start, clip.end, info?.duration)) {
      sfx.error();
      return flash(t("clip_invalid"));
    }
    const entries = fromPicker && picker ? picker.entries.filter((_, i) => picker.sel.has(i)) : undefined;
    if (fromPicker && !entries?.length) return;
    setBusy(true);
    onDownload({
      url: url.trim(), platform: det?.platform ?? "unknown", audioOnly, audioFormat,
      subLang: subs && !audioOnly ? subLang : undefined, quality, info, isPlaylist: det?.isPlaylist,
      entries, playlistTitle: picker?.title, clip,
    });
    setUrl("");
    setInfo(null);
    setPicker(null);
    setClipOn(false);
    window.setTimeout(() => setBusy(false), 600);
  }

  function go() {
    if (!url.trim()) return flash(t("paste_or_search"));
    if (looksLikeLink) {
      sfx.error();
      return flash(t("invalid_url"));
    }
    if (!isUrl) return void search();
    if (det?.isPlaylist && isNative()) return void openPicker();
    start(false);
  }

  return (
    <>
      <div className="hero">
        <div className="glow"><KewLogo size={92} /></div>
        <h2>{t("app_tagline")}</h2>
        <p>YouTube · TikTok · Instagram · X · Facebook · Vimeo · Reddit · SoundCloud · Twitch +</p>
      </div>

      <div className="card">
        <div className="url-row">
          <input
            className="url-input"
            placeholder={t("paste_hint")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }}
            enterKeyHint={isUrl ? "go" : "search"}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn btn-ghost" onClick={paste}><ClipboardPaste size={17} /> {t("paste_btn")}</button>
        </div>

        {meta && det && det.platform !== "unknown" && (
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="platform-badge" style={{ background: meta.color }}>
              <PlatformIcon platform={det.platform} size={15} /> {meta.name}
            </span>
            {det.isPlaylist && <span className="chip active"><ListVideo size={14} /> {t("playlist")}</span>}
            <span className="chip active"><CircleCheck size={14} /> {t("detected")}</span>
          </div>
        )}

        {(infoLoading || info) && det && det.platform !== "unknown" && (
          <div className="preview">
            <div className="preview-thumb">
              {info?.thumbnail ? (
                <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="shimmer">{det && <PlatformIcon platform={det.platform} size={26} />}</span>
              )}
              {info && fmtDur(info.duration) && <span className="dur">{fmtDur(info.duration)}</span>}
            </div>
            <div className="preview-meta">
              {infoLoading && !info ? (
                <>
                  <div className="line w70" />
                  <div className="line w40" />
                </>
              ) : (
                <>
                  <div className="preview-title">{info?.title}</div>
                  {info?.uploader && <div className="preview-sub">{info.uploader}</div>}
                </>
              )}
            </div>
          </div>
        )}

        <div className="opt-row">
          <div className={"toggle" + (audioOnly ? " on" : "")} onClick={() => setAudioOnly((a) => !a)}>
            {audioOnly ? <AudioLines size={17} /> : <Video size={17} />} {audioOnly ? t("audio_only") : t("video")}
          </div>
          {audioOnly ? (
            <div className="seg">
              {(["m4a", "mp3", "opus"] as const).map((f) => (
                <button key={f} className={f === audioFormat ? "on" : ""} onClick={() => setAudioFormat(f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          ) : (
            <div className={"seg" + (qualities ? " seg-q" : "")}>
              {(qualities
                ? [{ key: "max", label: "Max", size: "" }, ...qualities]
                : ["max", "1080", "720", "480"].map((q) => ({ key: q, label: q === "max" ? "Max" : q + "p", size: "" }))
              ).map((q) => (
                <button key={q.key} className={q.key === quality ? "on" : ""} onClick={() => setQuality(q.key)}>
                  {q.label}
                  {q.size && <small>{q.size}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
        {sizeHint && <div className="size-hint"><bdi dir="ltr">≈ {sizeHint}</bdi></div>}

        {!audioOnly && (
          <div className="opt-row">
            <div className={"toggle" + (subs ? " on" : "")} onClick={() => setSubs((s) => !s)}>
              <Captions size={17} /> {t("subs")}
            </div>
            {subs && (
              <div className="seg">
                {SUB_LANGS.map((l) => (
                  <button key={l} className={l === subLang ? "on" : ""} onClick={() => setSubLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isUrl && det && !det.isPlaylist && isNative() && (
          <div className="opt-row clip-row">
            <div className={"toggle" + (clipOn ? " on" : "")} onClick={() => setClipOn((c) => !c)}>
              <Scissors size={17} /> {t("clip")}
            </div>
            {clipOn && (
              <div className="clip-times">
                <label>
                  <span>{t("clip_start")}</span>
                  <input className="url-input" inputMode="numeric" placeholder="0:00" value={clipStart} onChange={(e) => setClipStart(e.target.value)} />
                </label>
                <span className="clip-dash">–</span>
                <label>
                  <span>{t("clip_end")}</span>
                  <input className="url-input" inputMode="numeric" placeholder={info?.duration ? fmtClock(info.duration) : "1:00"} value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} />
                </label>
              </div>
            )}
          </div>
        )}

        {picker && (
          <div className="picker">
            <div className="picker-head">
              <ListVideo size={15} /> {picker.loading ? t("loading_list") : `${t("pick_videos")} · ${picker.sel.size}/${picker.entries.length}`}
              {!picker.loading && (
                <span className="picker-tools">
                  <button className="chip" onClick={() => setPicker({ ...picker, sel: new Set(picker.entries.map((_, i) => i)) })}><CheckCheck size={14} /> {t("select_all")}</button>
                  <button className="chip" onClick={() => setPicker({ ...picker, sel: new Set() })}><Square size={14} /> {t("select_none")}</button>
                  <button className="icon-btn" aria-label="close" onClick={() => setPicker(null)}><X size={16} /></button>
                </span>
              )}
            </div>
            {picker.loading ? (
              <div className="picker-list">{[0, 1, 2].map((i) => <div key={i} className="pick-row"><div className="line w70" /></div>)}</div>
            ) : (
              <div className="picker-list">
                {picker.entries.map((e, i) => {
                  const on = picker.sel.has(i);
                  return (
                    <button key={i} className={"pick-row" + (on ? " on" : "")} onClick={() => toggleSel(i)}>
                      {on ? <SquareCheck size={18} /> : <Square size={18} />}
                      <span className="pick-n">{i + 1}</span>
                      {e.thumbnail && <img src={e.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                      <span className="pick-title">{e.title}</span>
                      {downloaded.has(urlKey(e.url)) && <span className="dl-badge"><Check size={12} /> {t("downloaded_badge")}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {picker && !picker.loading ? (
          <button className="btn btn-gold btn-block" onClick={() => start(true)} disabled={busy || picker.sel.size === 0}>
            <Download size={18} /> {t("download_selected")} ({picker.sel.size})
          </button>
        ) : url.trim() && !isUrl && !looksLikeLink ? (
          <button className="btn btn-gold btn-block" onClick={go} disabled={searching}>
            {searching ? <LoaderCircle size={18} className="spin" /> : <Search size={18} />}
            {searching ? t("searching") : t("search_btn")}
          </button>
        ) : (
          <button className="btn btn-gold btn-block" onClick={go} disabled={busy || !!picker?.loading}>
            {busy || picker?.loading ? <LoaderCircle size={18} className="spin" /> : det?.isPlaylist ? <ListVideo size={18} /> : <Download size={18} />}
            {busy ? t("analyzing") : det?.isPlaylist ? t("pick_videos") : t("download_btn")}
          </button>
        )}
      </div>

      {(searching || results) && (
        <div className="card search-card">
          <div className="search-head">
            <Search size={15} /> {t("search_results")}
            <div className="seg src-seg">
              <button className={source === "yt" ? "on" : ""} onClick={() => switchSource("yt")}><PlatformIcon platform="youtube" size={14} /> YouTube</button>
              <button className={source === "sc" ? "on" : ""} onClick={() => switchSource("sc")}><PlatformIcon platform="soundcloud" size={14} /> SoundCloud</button>
            </div>
            {results && !searching && (
              <button className="icon-btn" aria-label="close" onClick={() => { setResults(null); setLastQuery(""); }}><X size={16} /></button>
            )}
          </div>
          {searching &&
            [0, 1, 2].map((i) => (
              <div key={i} className="result">
                <div className="preview-thumb"><span className="shimmer"><Search size={20} /></span></div>
                <div className="preview-meta"><div className="line w70" /><div className="line w40" /></div>
              </div>
            ))}
          {results && results.length === 0 && !searching && <div className="search-empty">{t("no_results")}</div>}
          {!searching &&
            results?.map((r, i) => (
              <div key={r.url} className="result" style={{ "--n": i } as CSSProperties}>
                <div className="preview-thumb">
                  {r.thumbnail ? <img src={r.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <PlatformIcon platform={source === "sc" ? "soundcloud" : "youtube"} size={22} />}
                  {fmtDur(r.duration) && <span className="dur">{fmtDur(r.duration)}</span>}
                </div>
                <div className="preview-meta">
                  <div className="preview-title">{r.title}</div>
                  {r.uploader && <div className="preview-sub">{r.uploader}</div>}
                  <div className="result-actions">
                    {downloaded.has(urlKey(r.url)) && <span className="dl-badge"><Check size={12} /> {t("downloaded_badge")}</span>}
                    {(source === "sc" ? ([true] as const) : ([false, true] as const)).map((audio) => {
                      const done = added[r.url + (audio ? "#a" : "#v")];
                      return (
                        <button key={String(audio)} className={"chip" + (done ? " active" : "")} onClick={() => pick(r, audio)}>
                          {done ? <Check size={14} /> : audio ? <Music size={14} /> : <Video size={14} />}
                          {done ? t("added") : audio ? "MP3" : t("video")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          {!searching && results && results.length >= limit && limit < 30 && (
            <button className="btn btn-ghost btn-block more-btn" onClick={more} disabled={moreLoading}>
              {moreLoading ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />} {t("more_results")}
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ fontSize: 12, color: "var(--muted)" }}>
        <FolderDown size={15} /> {folder ? `${t("save_folder")}: ${folder}` : t("save_location")}
      </div>
    </>
  );
}
