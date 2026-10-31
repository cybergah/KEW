import { useState } from "react";
import { Captions, Download, ListVideo, X } from "lucide-react";
import { PlatformIcon } from "./PlatformIcon";
import type { TFn } from "../lib/i18n";
import { detect, PLATFORM_META } from "../lib/platform";
import type { Settings } from "../lib/store";
import { SUB_LANGS, type DownloadRequest } from "../screens/Home";

/**
 * "Download this?" sheet for links that arrive from outside the app
 * (Android share sheet, desktop browser/clipboard detection).
 */
export function ConfirmDialog({
  t,
  url,
  settings,
  onConfirm,
  onClose,
}: {
  t: TFn;
  url: string;
  settings: Settings;
  onConfirm: (req: DownloadRequest) => void;
  onClose: () => void;
}) {
  const [subs, setSubs] = useState(settings.subs);
  const [subLang, setSubLang] = useState(settings.subLang);
  const det = detect(url);
  const meta = PLATFORM_META[det.platform];
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="card confirm-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {det.isPlaylist ? t("confirm_playlist") : t("confirm_video")}
        </div>
        <div style={{ marginBottom: 8 }}>
          <span className="platform-badge" style={{ background: meta.color }}>
            <PlatformIcon platform={det.platform} size={15} /> {meta.name}
          </span>
          {det.isPlaylist && <span className="chip active" style={{ marginInlineStart: 6, display: "inline-flex" }}><ListVideo size={14} /> {t("playlist")}</span>}
        </div>
        <div className="confirm-url">{url}</div>
        <div className="opt-row" style={{ marginTop: 12 }}>
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
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-gold"
            style={{ flex: 1 }}
            onClick={() =>
              onConfirm({
                url,
                platform: det.platform,
                audioOnly: settings.audioOnly,
                audioFormat: settings.audioFormat,
                subLang: subs && !settings.audioOnly ? subLang : undefined,
                quality: settings.quality,
                isPlaylist: det.isPlaylist,
              })
            }
          >
            <Download size={18} /> {det.isPlaylist ? t("download_all") : t("download_btn")}
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            <X size={18} /> {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
