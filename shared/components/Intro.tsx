// Kew — intro splash. A gold ring draws itself, the keklik lands on its
// medallion, looks back over its shoulder, sings a few notes and flies off with
// them while the wordmark rises; then the stage fades into the app. Tap anywhere
// to skip. Cybergah Group.
import { useEffect, useRef, useState, type CSSProperties } from "react";

/** How long the reveal holds before it starts fading out (ms). */
const HOLD_MS = 3150;
const EXIT_MS = 450;

// a few slow-drifting specks of gold dust (fixed positions → no layout jank)
const DUST = [
  [12, 72, 0.0], [22, 30, 0.6], [31, 84, 1.1], [44, 18, 0.3], [58, 78, 0.9],
  [67, 26, 1.4], [76, 64, 0.2], [86, 40, 0.8], [91, 82, 1.2], [8, 48, 1.6],
];

export function Intro({ tagline, onSkip }: { tagline: string; onSkip: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.setTimeout(onSkip, EXIT_MS);
  };

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finish, reduce ? 900 : HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={"intro" + (leaving ? " leaving" : "")} onClick={finish} role="presentation">
      <div className="intro-light" />
      {DUST.map(([x, y, d], i) => (
        <span key={i} className="intro-dust" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` } as CSSProperties} />
      ))}

      <div className="intro-center">
        <div className="intro-emblem">
          <svg className="intro-ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="kewRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f2c862" />
                <stop offset="0.5" stopColor="#e2a82c" />
                <stop offset="1" stopColor="#a8730f" />
              </linearGradient>
            </defs>
            <circle className="ring-faint" cx="100" cy="100" r="96" />
            <circle className="ring-main" cx="100" cy="100" r="88" stroke="url(#kewRing)" />
          </svg>
          <div className="intro-disc" />

          {/* the Kew mark (shared/assets/keklik.svg), split into parts that move */}
          <svg className="intro-bird" viewBox="0 0 256 256" aria-label="Kew">
            <defs>
              <linearGradient id="ikBody" x1="0.15" y1="0.05" x2="0.75" y2="1">
                <stop offset="0" stopColor="#E3CF9B" />
                <stop offset="0.55" stopColor="#CDB57F" />
                <stop offset="1" stopColor="#A88A52" />
              </linearGradient>
              <linearGradient id="ikWing" x1="0" y1="0" x2="0.6" y2="1">
                <stop offset="0" stopColor="#B49660" />
                <stop offset="1" stopColor="#8E7444" />
              </linearGradient>
              <linearGradient id="ikTail" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8F7647" />
                <stop offset="1" stopColor="#6E5933" />
              </linearGradient>
              <linearGradient id="ikBeak" x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0" stopColor="#F0584A" />
                <stop offset="1" stopColor="#B92A21" />
              </linearGradient>
              <radialGradient id="ikBelly" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#F3E8C6" stopOpacity="0.55" />
                <stop offset="1" stopColor="#F3E8C6" stopOpacity="0" />
              </radialGradient>
              <clipPath id="ikClip"><path d="M70,112 C86,90 114,82 136,86 C134,62 150,40 175,40 C200,40 215,59 214,80 C214,95 207,106 199,114 C207,129 207,147 200,163 C190,192 160,207 128,207 C92,207 64,185 58,153 C56,137 61,123 70,112 Z" /></clipPath>
            </defs>

            <ellipse className="bird-shadow" cx="134" cy="240" rx="54" ry="6" />

            <g className="bird-fly">
              <g className="bird-body">
                {/* legs: bent ankle, three forward toes + hind toe */}
                <g className="bird-legs" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <g stroke="#A8261F">
                    <path d="M120,196 L116,213 L120,231" strokeWidth="6.5" />
                    <path d="M120,231 L136,234 M120,231 L132,239 M120,231 L125,242 M120,231 L109,234" strokeWidth="4" />
                    <circle cx="116" cy="213" r="3.4" fill="#A8261F" stroke="none" />
                  </g>
                  <g stroke="#D93A2E">
                    <path d="M150,196 L147,214 L155,231" strokeWidth="7" />
                    <path d="M155,231 L172,234 M155,231 L168,240 M155,231 L161,243 M155,231 L144,234" strokeWidth="4.3" />
                    <circle cx="147" cy="214" r="3.7" fill="#D93A2E" stroke="none" />
                  </g>
                </g>

                <path className="bird-tail" d="M76,118 C56,110 34,101 16,95 C27,117 42,140 63,153 Z" fill="url(#ikTail)" />

                {/* far wing, only seen in flight */}
                <path className="wing-far" d="M128,112 C112,74 92,44 60,26 C70,56 74,80 86,104 C72,94 58,88 42,88 C64,106 92,118 128,124 Z" fill="#8E7444" />

                <path d="M70,112 C86,90 114,82 136,86 C134,62 150,40 175,40 C200,40 215,59 214,80 C214,95 207,106 199,114 C207,129 207,147 200,163 C190,192 160,207 128,207 C92,207 64,185 58,153 C56,137 61,123 70,112 Z" fill="url(#ikBody)" />
                <g clipPath="url(#ikClip)">
                  <ellipse cx="146" cy="178" rx="62" ry="34" fill="url(#ikBelly)" />
                  <path d="M66,122 C84,94 114,86 138,90 C136,64 152,44 176,44" fill="none" stroke="#F6EBC8" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
                  <g strokeLinecap="round" strokeWidth="4.5">
                    <path d="M165,128 L157,160" stroke="#2A2318" />
                    <path d="M173,129 L165,163" stroke="#8A4B2A" />
                    <path d="M181,131 L173,165" stroke="#2A2318" />
                    <path d="M189,134 L181,166" stroke="#8A4B2A" />
                  </g>
                </g>

                {/* folded wing (perched) */}
                <g className="wing-folded">
                  <path d="M74,128 C90,102 128,98 152,116 C162,136 152,160 126,166 C100,170 80,154 74,128 Z" fill="url(#ikWing)" />
                  <g fill="none" stroke="#D9C28E" strokeWidth="2.4" strokeLinecap="round" opacity="0.75">
                    <path d="M94,146 C108,152 124,152 138,146" />
                    <path d="M90,134 C106,142 126,142 144,134" />
                    <path d="M92,122 C108,128 128,128 146,122" />
                  </g>
                </g>
                {/* open wing (flight): pivots at the shoulder */}
                <g className="wing-open">
                  <path d="M138,118 C118,78 92,46 52,26 C64,58 70,82 82,104 C68,96 50,92 32,94 C58,114 96,126 138,130 Z" fill="url(#ikWing)" />
                  <g fill="none" stroke="#D9C28E" strokeWidth="2.4" strokeLinecap="round" opacity="0.75">
                    <path d="M126,116 C110,90 92,68 70,52" />
                    <path d="M120,122 C102,104 84,94 62,92" />
                  </g>
                </g>

                {/* head details — flip around the neck to look back */}
                <g className="bird-face">
                  <path d="M183,72 C198,71 212,80 213,93 C211,109 200,119 186,122 C171,122 159,112 158,98 C158,85 169,74 183,72 Z" fill="#F7EFD8" />
                  <path d="M212,73 C200,68 180,68 168,79 C157,90 159,111 176,120 C186,126 199,122 205,113" fill="none" stroke="#1B1A16" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="189" cy="72" r="8.5" fill="#E04A3A" />
                  <circle className="bird-eye" cx="189" cy="72" r="5.8" fill="#16140F" />
                  <circle cx="191" cy="69.8" r="1.9" fill="#FFF8E6" />
                  <g className="bird-beak">
                    <path d="M207,67 C222,67 233,74 238,82 C228,87 217,91 207,91 C204,83 204,75 207,67 Z" fill="url(#ikBeak)" />
                    <path d="M208,79 C218,79 228,80 237,82" fill="none" stroke="#8E1F18" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
                  </g>
                </g>
              </g>

              {/* the song: notes rise from the beak, then trail the flight */}
              <g className="bird-notes" fill="#F2C862">
                <text className="note n1" x="232" y="64">♪</text>
                <text className="note n2" x="246" y="44">♫</text>
                <text className="note n3" x="226" y="34">♪</text>
                <text className="note n4" x="40" y="150">♫</text>
                <text className="note n5" x="22" y="118">♪</text>
              </g>
            </g>
          </svg>
          <span className="intro-gloss" />
        </div>

        <div className="intro-word" aria-label="KEW">
          {"KEW".split("").map((c, i) => (
            <span key={i} style={{ "--n": i } as CSSProperties}>{c}</span>
          ))}
        </div>
        <div className="intro-rule" />
        <div className="intro-tag">{tagline}</div>
      </div>

      <div className="intro-by">Cybergah Group · cybergah.com</div>
      <div className="intro-progress"><i /></div>
    </div>
  );
}
