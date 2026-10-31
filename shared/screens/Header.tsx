import { useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { KewLogo } from "../assets/Logo";
import { LANGS, type Lang, type TFn } from "../lib/i18n";

export function Header({ lang, t, onLang }: { lang: Lang; t: TFn; onLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="brand">
        <KewLogo size={44} />
        <div>
          <h1>KEW</h1>
          <div className="tag">{t("app_tagline")}</div>
        </div>
      </div>
      <div className="spacer" />
      <div style={{ position: "relative" }}>
        <button className="lang-pill" onClick={() => setOpen((o) => !o)}>
          <Globe size={16} /> {LANGS.find((l) => l.code === lang)?.label}
        </button>
        {open && (
          <div className="card" style={{ position: "absolute", right: 0, top: 44, zIndex: 30, minWidth: 150, padding: 8 }}>
            {LANGS.map((l) => (
              <div
                key={l.code}
                className={"lang-opt" + (l.code === lang ? " on" : "")}
                style={{ marginBottom: 6 }}
                onClick={() => { onLang(l.code); setOpen(false); }}
              >
                <span className="lang-code">{l.code.toUpperCase()}</span> {l.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function TabBtn({ ico, label, on, onClick }: { ico: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={"tab" + (on ? " on" : "")} onClick={onClick}>
      <span className="ico">{ico}</span>
      <span>{label}</span>
    </button>
  );
}
