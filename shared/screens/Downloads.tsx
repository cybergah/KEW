import { Fragment, useState } from "react";
import { AudioLines, ChevronDown, ChevronRight, ChevronUp, Download, ExternalLink, FolderOpen, ListVideo, Pause, Play, RotateCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { PlatformIcon } from "../components/PlatformIcon";
import type { TFn } from "../lib/i18n";
import { PLATFORM_META, type Platform } from "../lib/platform";
import type { DownloadRecord } from "../lib/store";
import { filterDownloads, groupBatches, humanError, isActive, platformsIn, type KindFilter } from "../lib/downloads";

const KINDS: { k: KindFilter; label: string }[] = [
  { k: "all", label: "f_all" },
  { k: "video", label: "f_video" },
  { k: "audio", label: "f_audio" },
  { k: "active", label: "f_active" },
  { k: "failed", label: "f_failed" },
];

export function DownloadsScreen({
  t,
  downloads,
  onPlay,
  onOpen,
  onDelete,
  onPause,
  onResume,
  onCancel,
  onPauseBatch,
  onResumeBatch,
  onCancelBatch,
  onRetryFailed,
  batchTitle,
  onFolder,
  onClearDone,
}: {
  t: TFn;
  downloads: DownloadRecord[];
  onPlay: (d: DownloadRecord) => void;
  onOpen: (d: DownloadRecord) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onPauseBatch: (batchId: string) => void;
  onResumeBatch: (batchId: string) => void;
  onCancelBatch: (batchId: string) => void;
  onRetryFailed: () => void;
  batchTitle: (batchId: string) => string;
  onFolder: (d: DownloadRecord) => void;
  onClearDone: () => void;
}) {
  // Playlist groups start collapsed so long lists don't take over the screen.
  const [openB, setOpenB] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  if (downloads.length === 0) {
    return (
      <div className="empty">
        <div className="big"><Download /></div>
        <h3>{t("no_downloads")}</h3>
        <p>{t("no_downloads_hint")}</p>
      </div>
    );
  }
  const statusText = (d: DownloadRecord) => {
    switch (d.status) {
      case "running":
        return (d.progress != null && d.progress >= 0 ? `${Math.round(d.progress)}% · ` : "") + t("progress");
      case "queued":
        return t("queued");
      case "paused":
        return (d.progress != null && d.progress >= 0 ? `${Math.round(d.progress)}% · ` : "") + t("paused");
      case "completed":
        return t("completed");
      default:
        return t("failed");
    }
  };
  const renderItem = (d: DownloadRecord) => {
    const meta = PLATFORM_META[d.platform];
    const active = isActive(d);
    return (
      <div className={"card dl-card is-" + d.status} key={d.id}>
        <div className="dl">
          <div className="thumb" style={{ color: d.platform === "x" || d.platform === "tiktok" ? "var(--text)" : meta.color, overflow: "hidden" }}>
            {d.thumbnail && !d.audioOnly ? (
              <img src={d.thumbnail} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : d.audioOnly ? (
              <AudioLines size={22} />
            ) : (
              <PlatformIcon platform={d.platform} size={22} />
            )}
          </div>
          <div className="meta">
            <div className="name">{d.title}</div>
            <div className="sub">
              <span className={"status-dot " + d.status} /> {statusText(d)}
              {" · "}{meta.name}
            </div>
          </div>
          <div className="acts">
            {d.status === "completed" && !d.audioOnly && (
              <button className="icon-btn" title={t("play")} onClick={() => onPlay(d)}><Play /></button>
            )}
            {d.status === "completed" && (
              <button className="icon-btn" title={t("open")} onClick={() => onOpen(d)}><ExternalLink /></button>
            )}
            {d.status === "completed" && (
              <button className="icon-btn" title={t("open_folder")} onClick={() => onFolder(d)}><FolderOpen /></button>
            )}
            {d.status === "running" && (
              <button className="icon-btn" title={t("pause")} onClick={() => onPause(d.id)}><Pause /></button>
            )}
            {(d.status === "paused" || d.status === "failed") && (
              <button className="icon-btn" title={d.status === "failed" ? t("retry") : t("resume")} onClick={() => onResume(d.id)}>
                {d.status === "failed" ? <RotateCw /> : <Play />}
              </button>
            )}
            {active ? (
              <button className="icon-btn danger" title={t("cancel")} onClick={() => onCancel(d.id)}><X /></button>
            ) : (
              <button className="icon-btn danger" title={t("delete")} onClick={() => onDelete(d.id)}><Trash2 /></button>
            )}
          </div>
        </div>
        {(d.status === "running" || d.status === "paused") && (
          <div className="bar">
            <i style={{ width: d.progress != null && d.progress >= 0 ? `${d.progress}%` : "15%" }} />
          </div>
        )}
        {d.status === "failed" && d.statusLine && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)", wordBreak: "break-word" }}>
            {humanError(d.statusLine, t)}
          </div>
        )}
      </div>
    );
  };

  const platforms = platformsIn(downloads);
  const failedCount = downloads.filter((d) => d.status === "failed").length;
  const shown = filterDownloads(downloads, { q, kind, platform });
  const groups = groupBatches(shown);

  return (
    <>
      <div className="dl-tools">
        <div className="search-box">
          <Search size={16} />
          <input
            className="url-input"
            placeholder={t("search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn btn-ghost" onClick={onClearDone}><Sparkles size={16} /> {t("clear_done")}</button>
      </div>
      <div className="dl-filters">
        {KINDS.map(({ k, label }) => (
          <button key={k} className={"chip" + (kind === k ? " active" : "")} onClick={() => setKind(k)}>
            {t(label)}
          </button>
        ))}
        {platforms.length > 1 && (
          <select
            className="chip dl-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | "all")}
          >
            <option value="all">{t("f_all")}</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_META[p].name}
              </option>
            ))}
          </select>
        )}
      </div>
      {failedCount > 0 && (
        <button className="btn btn-ghost btn-block dl-retry" onClick={onRetryFailed}>
          <RotateCw size={16} /> {t("retry_failed")} ({failedCount})
        </button>
      )}
      {shown.length === 0 && <div className="empty-sm">{t("no_match")}</div>}
      {groups.map((g) => {
        if (!g.batchId || g.items.length < 2) return <Fragment key={g.items[0].id}>{g.items.map(renderItem)}</Fragment>;
        const done = g.items.filter((x) => x.status === "completed").length;
        const anyActive = g.items.some((x) => x.status === "running" || x.status === "queued");
        const anyPaused = g.items.some((x) => x.status === "paused");
        const open = !!openB[g.batchId];
        const running = g.items.find((x) => x.status === "running");
        const pct = Math.round(
          g.items.reduce((s, x) => s + (x.status === "completed" ? 100 : Math.max(0, x.progress ?? 0)), 0) / g.items.length
        );
        const toggle = () => setOpenB((o) => ({ ...o, [g.batchId!]: !open }));
        return (
          <div key={g.batchId} className="batch">
            <div className="batch-head clickable" onClick={toggle}>
              <span className={"chev" + (open ? " open" : "")}><ChevronRight size={16} /></span>
              <div className="batch-meta">
                <div className="batch-title"><ListVideo size={15} /> {batchTitle(g.batchId)}</div>
                <div className="batch-sub">
                  {done}/{g.items.length} · {t("completed")}
                  {!open && running ? ` · ${running.title.slice(0, 34)}` : ""}
                </div>
              </div>
              <div className="acts" onClick={(e) => e.stopPropagation()}>
                {anyActive && (
                  <button className="icon-btn" title={t("pause")} onClick={() => onPauseBatch(g.batchId!)}><Pause /></button>
                )}
                {anyPaused && (
                  <button className="icon-btn" title={t("resume")} onClick={() => onResumeBatch(g.batchId!)}><Play /></button>
                )}
                <button className="icon-btn danger" title={t("cancel")} onClick={() => onCancelBatch(g.batchId!)}><X /></button>
              </div>
            </div>
            {!open && (anyActive || anyPaused) && (
              <div className="bar batch-bar"><i style={{ width: `${Math.max(pct, 3)}%` }} /></div>
            )}
            {open && g.items.map(renderItem)}
            <button className="batch-toggle" onClick={toggle}>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {open ? t("collapse") : `${t("expand")} (${g.items.length})`}
            </button>
          </div>
        );
      })}
    </>
  );
}
