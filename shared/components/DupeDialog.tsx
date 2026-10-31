// "You already downloaded this" — offered before a repeat download starts.
import { Download, ExternalLink, X } from "lucide-react";
import type { TFn } from "../lib/i18n";
import type { DownloadRecord } from "../lib/store";

export function DupeDialog({
  t,
  rec,
  onOpen,
  onAgain,
  onClose,
}: {
  t: TFn;
  rec: DownloadRecord;
  onOpen: () => void;
  onAgain: () => void;
  onClose: () => void;
}) {
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="card confirm-card dupe-card" onClick={(e) => e.stopPropagation()}>
        <div className="dupe-head">
          {rec.thumbnail && <img src={rec.thumbnail} alt="" referrerPolicy="no-referrer" />}
          <div>
            <div style={{ fontWeight: 700 }}>{t("already_title")}</div>
            <div className="confirm-url" style={{ marginTop: 4 }}>{rec.title}</div>
          </div>
        </div>
        <p className="dupe-body">{t("already_body")}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-gold" style={{ flex: 1 }} onClick={onOpen}>
            <ExternalLink size={18} /> {t("open")}
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onAgain}>
            <Download size={18} /> {t("download_again")}
          </button>
          <button className="icon-btn" title={t("cancel")} onClick={onClose}><X /></button>
        </div>
      </div>
    </div>
  );
}
