import { useEffect, useState } from "react";
import { Bell, BellOff, Bird, FolderOpen, RotateCcw, Volume2, VolumeX, ClipboardList, Cpu, Flag, Globe, Monitor, Power, RotateCw, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { KewLogo } from "../assets/Logo";
import { LANGS, type TFn } from "../lib/i18n";
import type { Settings } from "../lib/store";
import { canChooseFolder, chooseSaveFolder, engineUpdate, engineVersion, getSaveFolder, isDesktop, resetSaveFolder, type SaveFolder } from "@native";

export function AboutScreen({
  t,
  settings,
  patchSettings,
  flash,
}: {
  t: TFn;
  settings: Settings;
  patchSettings: (p: Partial<Settings>) => void;
  flash: (m: string) => void;
}) {
  return (
    <>
      <div className="card" style={{ textAlign: "center" }}>
        <div className="glow"><KewLogo size={80} /></div>
        <h2 style={{ margin: "12px 0 2px" }}>Kew</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("about_title")}</p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>{t("about_body")}</p>
        <span className="badge-foss"><ShieldCheck size={13} /> {t("open_source")}</span>
      </div>

      <div className="card">
        <div className="manifesto">
          <h3 className="h-ico" style={{ margin: "0 0 8px", color: "var(--gold-soft)" }}><Flag size={18} /> {t("manifesto_title")}</h3>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14 }}>{t("manifesto_body")}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="h-ico" style={{ marginTop: 0 }}><SettingsIcon size={18} /> {t("settings")}</h3>
        <div className="row">
          <label className="h-ico"><Cpu size={14} /> yt-dlp · on-device</label>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("engine_note")}
          </div>
          <EngineRow t={t} flash={flash} />
        </div>
        <div className="row">
          <label>{t("notifications")}</label>
          <div className="opt-row">
            <div
              className={"toggle" + (settings.notify ? " on" : "")}
              onClick={() => patchSettings({ notify: !settings.notify })}
            >
              {settings.notify ? <Bell size={17} /> : <BellOff size={17} />} {t("notifications")}
            </div>
            <div
              className={"toggle" + (settings.sound ? " on" : "")}
              onClick={() => patchSettings({ sound: !settings.sound })}
            >
              <Bird size={17} /> {t("keklik_sound")}
            </div>
            <div
              className={"toggle" + (settings.uiSounds ? " on" : "")}
              onClick={() => patchSettings({ uiSounds: !settings.uiSounds })}
            >
              {settings.uiSounds ? <Volume2 size={17} /> : <VolumeX size={17} />} {t("ui_sounds")}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{t("notif_note")}</div>
        </div>
        {canChooseFolder && <FolderRow t={t} />}

        {isDesktop && (
          <div className="row">
            <label className="h-ico"><Monitor size={14} /> Desktop</label>
            <div className="opt-row" style={{ flexWrap: "wrap" }}>
              <div
                className={"toggle" + (settings.watchBrowser ? " on" : "")}
                onClick={() => patchSettings({ watchBrowser: !settings.watchBrowser })}
              >
                <Globe size={17} /> {t("watch_browser")}
              </div>
              <div
                className={"toggle" + (settings.watchClipboard ? " on" : "")}
                onClick={() => patchSettings({ watchClipboard: !settings.watchClipboard })}
              >
                <ClipboardList size={17} /> {t("watch_clip")}
              </div>
              <div
                className={"toggle" + (settings.autoStart ? " on" : "")}
                onClick={() => patchSettings({ autoStart: !settings.autoStart })}
              >
                <Power size={17} /> {t("autostart")}
              </div>
            </div>
          </div>
        )}
        <div className="row">
          <label>{t("parallel")}</label>
          <div className="seg" style={{ display: "inline-flex" }}>
            {[1, 2, 3].map((n) => (
              <button key={n} className={n === settings.concurrent ? "on" : ""} onClick={() => patchSettings({ concurrent: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>{t("language")}</label>
          <div className="lang-grid">
            {LANGS.map((l) => (
              <div
                key={l.code}
                className={"lang-opt" + (l.code === settings.lang ? " on" : "")}
                onClick={() => patchSettings({ lang: l.code })}
              >
                <span className="lang-code">{l.code.toUpperCase()}</span> {l.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sig">
        <div className="glow" style={{ display: "inline-block" }}><KewLogo size={36} /></div>
        <div>{t("by_cybergah")}</div>
        <div><strong>Cybergah Group</strong> · <a href="https://cybergah.com" target="_blank" rel="noreferrer">cybergah.com</a></div>
        <div>info@cybergah.com</div>
        <div style={{ opacity: 0.6, marginTop: 6 }}>Kew v2.0.0 · GPL-3.0 · © 2026</div>
      </div>
    </>
  );
}

/** Installed yt-dlp version + manual update (hidden where the platform can't report it). */
function EngineRow({ t, flash }: { t: TFn; flash: (m: string) => void }) {
  const [version, setVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    let alive = true;
    engineVersion().then((v) => alive && setVersion(v)).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!version) return null;

  async function update() {
    setUpdating(true);
    try {
      const r = await engineUpdate();
      if (r.version) setVersion(r.version);
      flash(r.ok ? `${t("engine_updated")} · ${r.version || ""}`.trim() : t("engine_update_fail"));
    } catch {
      flash(t("engine_update_fail"));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="engine-row">
      <span>{t("engine_version")}:</span>
      <code>{version}</code>
      <button className="btn btn-ghost" onClick={update} disabled={updating}>
        <RotateCw size={14} className={updating ? "spin" : undefined} />
        {updating ? t("engine_updating") : t("engine_update")}
      </button>
    </div>
  );
}

/** Desktop: where downloads are saved. The folder is picked with the native
 *  dialog in the main process; the app may only read/play inside it. */
function FolderRow({ t }: { t: TFn }) {
  const [f, setF] = useState<SaveFolder | null>(null);
  useEffect(() => {
    getSaveFolder().then(setF).catch(() => {});
  }, []);
  return (
    <div className="row">
      <label className="h-ico"><FolderOpen size={14} /> {t("save_folder")}</label>
      <div className="folder-path" title={f?.path}>{f?.path || "…"}</div>
      <div className="opt-row" style={{ marginTop: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => chooseSaveFolder().then((x) => x && setF(x))}>
          <FolderOpen size={16} /> {t("change_folder")}
        </button>
        {f?.custom && (
          <button className="btn btn-ghost" onClick={() => resetSaveFolder().then((x) => x && setF(x))}>
            <RotateCcw size={16} /> {t("default_folder")}
          </button>
        )}
      </div>
    </div>
  );
}
