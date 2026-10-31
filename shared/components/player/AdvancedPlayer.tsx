import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Clapperboard, FastForward, Gauge, Maximize, Moon, Music, Pause, Play, Repeat, Repeat1, Rewind, RotateCcw, Shuffle, SkipBack, SkipForward, Undo2, Redo2, Volume2, VolumeX, X } from "lucide-react";
import { mediaSession, onMediaControl } from "@native";
import { fmtTime, posClear, posGet, posSet, RATES, SLEEPS, type LibItem, type RepeatMode } from "./media";

/* ---------------- advanced player ---------------- */

export function AdvancedPlayer({
  kind,
  item,
  full,
  posInfo,
  t,
  hasPrev,
  hasNext,
  shuffle,
  onShuffle,
  repeat,
  onRepeat,
  onPrev,
  onNext,
  onEnded,
  onBack,
  onExpand,
  onClose,
}: {
  kind: "video" | "music";
  item: LibItem;
  full: boolean;
  posInfo?: string;
  t: (k: string) => string;
  hasPrev: boolean;
  hasNext: boolean;
  shuffle: boolean;
  onShuffle: () => void;
  /** off · all (loop the list) · one (loop this track) */
  repeat: RepeatMode;
  onRepeat: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEnded: () => void;
  onBack: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const vref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [resumed, setResumed] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const sleepEndRef = useRef(0);
  const [gest, setGest] = useState<{ side: "l" | "r" | "vol"; text: ReactNode } | null>(null);
  const gestTimer = useRef<number | undefined>(undefined);
  const lastSaveRef = useRef(0);

  // Foreground media service keeps playback alive in the background and
  // drives the lock-screen player (title, play state, position, seek bar).
  function reportState() {
    const v = vref.current;
    mediaSession({
      active: true,
      title: item.title,
      playing: v ? !v.paused : playing,
      position: Math.round((v?.currentTime || 0) * 1000),
      duration: Math.round((v?.duration || 0) * 1000),
      rate,
    });
  }
  useEffect(() => {
    reportState();
  }, [playing, item.src, rate, dur]);
  useEffect(() => () => { mediaSession({ active: false }); }, []);

  // Lock-screen / notification buttons (prev · play/pause · next · seek).
  const ctlRef = useRef({ next: () => {}, prev: () => {} });
  ctlRef.current.next = () => { if (hasNext || shuffle || repeat === "all") onNext(); };
  ctlRef.current.prev = smartPrev;
  useEffect(() => {
    let h: { remove: () => void } | undefined;
    onMediaControl((e) => {
      const v = vref.current;
      if (!v) return;
      if (e.cmd === "play") v.play();
      else if (e.cmd === "pause") v.pause();
      else if (e.cmd === "toggle") { if (v.paused) v.play(); else v.pause(); }
      else if (e.cmd === "next") ctlRef.current.next();
      else if (e.cmd === "prev") ctlRef.current.prev();
      else if (e.cmd === "seek" && typeof e.pos === "number") v.currentTime = e.pos / 1000;
    }).then((x) => (h = x));
    return () => h?.remove();
  }, []);

  useEffect(() => {
    const v = vref.current;
    if (v) v.playbackRate = rate;
  }, [rate, item.src]);

  // Save the position on unmount / track change so "resume" works next time.
  useEffect(() => {
    return () => {
      const v = vref.current;
      if (v && v.currentTime > 10 && (v.duration || 0) - v.currentTime > 20) posSet(item.src, v.currentTime);
    };
  }, [item.src]);

  // Sleep timer countdown.
  useEffect(() => {
    if (!sleepMin) { sleepEndRef.current = 0; setSleepLeft(0); return; }
    sleepEndRef.current = Date.now() + sleepMin * 60 * 1000;
    setSleepLeft(sleepMin * 60);
    const iv = window.setInterval(() => {
      const left = Math.round((sleepEndRef.current - Date.now()) / 1000);
      setSleepLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(iv);
        setSleepMin(0);
        vref.current?.pause();
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [sleepMin, item.src]);

  function flashGest(side: "l" | "r" | "vol", text: ReactNode) {
    setGest({ side, text });
    window.clearTimeout(gestTimer.current);
    gestTimer.current = window.setTimeout(() => setGest(null), 700);
  }
  function seekBy(d: number) {
    const v = vref.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + d));
  }
  function toggle() {
    const v = vref.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }
  // Professional prev: restart the track first, go to the previous one only
  // when we are within the first 3 seconds.
  function smartPrev() {
    const v = vref.current;
    if (v && v.currentTime > 3) { v.currentTime = 0; return; }
    if (hasPrev) onPrev();
    else if (v) v.currentTime = 0;
  }
  async function fullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        try { (screen.orientation as any)?.unlock?.(); } catch {}
      } else {
        await el.requestFullscreen();
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch {}
      }
    } catch {}
  }

  // --- YouTube-style gestures on the stage ---
  // double-tap right/left third: ±10s · vertical drag: volume · single tap: play/pause
  const tapRef = useRef<{ time: number; x: number } | null>(null);
  const tapTimer = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ y: number; vol: number; moved: boolean } | null>(null);

  function stagePoint(e: React.TouchEvent | React.MouseEvent): { x: number; y: number; w: number } {
    const r = (wrapRef.current as HTMLDivElement).getBoundingClientRect();
    const p = "touches" in e ? (e.changedTouches[0] || e.touches[0]) : (e as React.MouseEvent);
    return { x: p.clientX - r.left, y: p.clientY - r.top, w: r.width };
  }
  function handleTap(x: number, w: number) {
    const now = Date.now();
    const prev = tapRef.current;
    tapRef.current = { time: now, x };
    if (prev && now - prev.time < 280 && Math.abs(prev.x - x) < 80) {
      // double tap
      window.clearTimeout(tapTimer.current);
      tapRef.current = null;
      if (x > w * 0.6) { seekBy(10); flashGest("r", <><FastForward size={18} /> +10s</>); }
      else if (x < w * 0.4) { seekBy(-10); flashGest("l", <><Rewind size={18} /> −10s</>); }
      else toggle();
      return;
    }
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => { toggle(); }, 290);
  }
  function onTouchStart(e: React.TouchEvent) {
    const v = vref.current;
    const p = stagePoint(e);
    dragRef.current = { y: p.y, vol: v ? v.volume : 1, moved: false };
  }
  function onTouchMove(e: React.TouchEvent) {
    const d = dragRef.current;
    const v = vref.current;
    if (!d || !v) return;
    const p = stagePoint(e);
    const dy = d.y - p.y;
    if (Math.abs(dy) > 18) {
      d.moved = true;
      const vol = Math.max(0, Math.min(1, d.vol + dy / 260));
      v.volume = vol;
      flashGest("vol", <>{vol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />} {Math.round(vol * 100)}%</>);
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.moved) return; // it was a volume drag, not a tap
    const p = stagePoint(e);
    handleTap(p.x, p.w);
  }
  function onStageClick(e: React.MouseEvent) {
    // mouse path (desktop): same single/double-tap logic
    if ((e as any).detail === 0) return;
    const p = stagePoint(e);
    handleTap(p.x, p.w);
  }

  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className={"np " + (full ? "np-full" : "np-mini-wrap")}>
      {/* --- top bar (dedicated screen) --- */}
      <div className="np-top">
        <button className="icon-btn" onClick={onBack}><ArrowLeft className="flip-rtl" /></button>
        <div className="np-top-meta">
          <div className="np-top-title">{item.title}</div>
          {posInfo && <div className="np-top-sub">{posInfo}</div>}
        </div>
        <button className="icon-btn danger" onClick={onClose}><X /></button>
      </div>

      {/* --- stage: video frame or spinning album art --- */}
      <div className="np-stage-outer">
        <div
          ref={wrapRef}
          className={"player-stage" + (kind === "music" ? " audio" : "")}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={onStageClick}
        >
          {kind === "music" && (
            <div className="np-art-box">
              <div className={"np-art" + (playing ? " playing" : "")}><Music /></div>
            </div>
          )}
          <video
            ref={vref}
            src={item.src}
            autoPlay
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              const v = e.target as HTMLVideoElement;
              const saved = posGet(item.src);
              if (saved > 10 && (v.duration || 0) - saved > 20) {
                v.currentTime = saved;
                setResumed(true);
                window.setTimeout(() => setResumed(false), 6000);
              }
            }}
            onTimeUpdate={(e) => {
              const v = e.target as HTMLVideoElement;
              setPos(v.currentTime);
              // persist the position every ~5s for "resume playback"
              const now = Date.now();
              if (now - lastSaveRef.current > 5000 && v.currentTime > 10) {
                lastSaveRef.current = now;
                posSet(item.src, v.currentTime);
              }
            }}
            onDurationChange={(e) => setDur((e.target as HTMLVideoElement).duration || 0)}
            onSeeked={reportState}
            onEnded={() => {
              posClear(item.src);
              if (repeat === "one") {
                const v = vref.current;
                if (v) { v.currentTime = 0; v.play(); }
              } else onEnded();
            }}
          >
            {item.sub && <track kind="subtitles" src={item.sub} label="CC" default />}
          </video>

          {/* gesture feedback (double-tap seek / volume) */}
          {gest && (
            <div className={"gest-ind " + gest.side}>{gest.text}</div>
          )}
          {resumed && (
            <button
              className="resume-chip"
              onClick={(e) => {
                e.stopPropagation();
                const v = vref.current;
                if (v) v.currentTime = 0;
                setResumed(false);
              }}
            >
              <RotateCcw size={14} /> {t("restart")}
            </button>
          )}
        </div>
      </div>

      <div className="np-info">
        <div className="player-title">{item.title}</div>
        {item.artist && <div className="player-sub">{item.artist}</div>}
      </div>

      {/* --- controls, pinned to the bottom of the screen --- */}
      <div className="np-controls">
        <input
          className="player-seek"
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={Math.min(pos, dur || 0)}
          onChange={(e) => {
            const v = vref.current;
            if (v) v.currentTime = parseFloat(e.target.value);
          }}
        />
        <div className="player-times">
          <span>{fmtTime(pos)}</span>
          <span>{fmtTime(dur)}</span>
        </div>
        <div className="player-ctrl">
          <button className="icon-btn rnd" onClick={smartPrev}><SkipBack /></button>
          <button className="icon-btn rnd seek-btn" onClick={() => seekBy(-10)}><Undo2 /><small>10</small></button>
          <button className="icon-btn big-play" onClick={toggle}>{playing ? <Pause /> : <Play />}</button>
          <button className="icon-btn rnd seek-btn" onClick={() => seekBy(10)}><Redo2 /><small>10</small></button>
          <button className="icon-btn rnd" disabled={!hasNext && !shuffle && repeat !== "all"} onClick={onNext}><SkipForward /></button>
        </div>
        <div className="player-ctrl sub">
          <button className="chip-btn" onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}>
            <Gauge size={15} /> {rate}×
          </button>
          <button
            className={"chip-btn" + (repeat !== "off" ? " on" : "")}
            title={t(repeat === "all" ? "repeat_all" : repeat === "one" ? "repeat_one" : "repeat_off")}
            onClick={onRepeat}
          >
            {repeat === "one" ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
          {kind === "music" && (
            <button className={"chip-btn" + (shuffle ? " on" : "")} onClick={onShuffle}><Shuffle size={15} /></button>
          )}
          <button
            className={"chip-btn" + (sleepMin ? " on" : "")}
            onClick={() => setSleepMin(SLEEPS[(SLEEPS.indexOf(sleepMin) + 1) % SLEEPS.length])}
          >
            <Moon size={15} /> {sleepMin ? fmtTime(sleepLeft) : t("sleep")}
          </button>
          {kind === "video" && <button className="chip-btn" onClick={fullscreen}><Maximize size={15} /></button>}
        </div>
      </div>

      {/* --- mini bar (list mode): playback continues, tap to reopen --- */}
      <div className="np-bar" onClick={onExpand}>
        <div className="np-bar-fill" style={{ width: `${pct}%` }} />
        <div className="np-bar-ico">{kind === "music" ? <Music size={20} /> : <Clapperboard size={20} />}</div>
        <div className="np-bar-meta">
          <div className="np-bar-title">{item.title}</div>
          <div className="np-bar-sub">{fmtTime(pos)} / {fmtTime(dur)}</div>
        </div>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggle(); }}>
          {playing ? <Pause /> : <Play />}
        </button>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}><X /></button>
      </div>
    </div>
  );
}
