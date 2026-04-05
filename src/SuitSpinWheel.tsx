import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';

/** Vite resolves this to a real URL in dev/build (avoids missing public/fahhhhh.mp3). */
import voiceSrc from './assets/fahhhhh.mp3';

type SuitFamily = 'black' | 'red';

const STORAGE_TICKS = 'suitWheel_audioTicks';
const STORAGE_VOICE = 'suitWheel_voice';

const SEGMENTS: ReadonlyArray<{
  id: number;
  name: string;
  symbol: string;
  family: SuitFamily;
  fill: string;
  stroke: string;
  labelClass: string;
}> = [
  {
    id: 0,
    name: 'Hukum',
    symbol: '♠',
    family: 'black',
    fill: '#0c1522',
    stroke: '#38bdf8',
    labelClass:
      'fill-cyan-200 drop-shadow-[0_0_10px_rgba(165,243,252,0.95)]',
  },
  {
    id: 1,
    name: 'Dil',
    symbol: '♥',
    family: 'red',
    fill: '#3a121c',
    stroke: '#fb7185',
    labelClass:
      'fill-rose-50 drop-shadow-[0_0_12px_rgba(255,228,230,0.95)]',
  },
  {
    id: 2,
    name: 'Chidi',
    symbol: '♣',
    family: 'black',
    fill: '#08141c',
    stroke: '#5eead4',
    labelClass:
      'fill-teal-100 drop-shadow-[0_0_10px_rgba(153,246,228,0.95)]',
  },
  {
    id: 3,
    name: 'Diamond',
    symbol: '♦',
    family: 'red',
    fill: '#451a2e',
    stroke: '#f9a8d4',
    labelClass:
      'fill-pink-50 drop-shadow-[0_0_12px_rgba(252,231,243,0.95)]',
  },
];

/** Clockwise degrees from top to each wedge center (matches SVG slice order). */
const CENTER_DEG = [45, 135, 225, 315] as const;

const BLACK_POOL = SEGMENTS.filter((s) => s.family === 'black').map((s) => s.id);
const RED_POOL = SEGMENTS.filter((s) => s.family === 'red').map((s) => s.id);

const INITIAL_COUNTS: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 0,
};

/** Until every suit has landed at least once, each suit can win at most this many times. */
const MAX_PER_SUIT_BEFORE_ALL_SEEN = 2;

/** Previous 4 spins + this spin = 5; each colour (black/red) appears at most twice in that window. */
const MAX_SAME_COLOUR_IN_WINDOW = 2;

function allSuitsHaveAppearedOnce(counts: Record<number, number>): boolean {
  return SEGMENTS.every((s) => (counts[s.id] ?? 0) >= 1);
}

function countColourInLastFour(families: readonly SuitFamily[], colour: SuitFamily): number {
  return families.filter((f) => f === colour).length;
}

/**
 * Adding one spin with `colour` must keep that colour's count in (lastFour + new) ≤ 2.
 * lastFour = outcomes of the previous 4 spins (oldest → newest).
 */
function canAddColourWithoutBreakingWindow(
  lastFourFamilies: readonly SuitFamily[],
  colour: SuitFamily,
): boolean {
  return countColourInLastFour(lastFourFamilies, colour) < MAX_SAME_COLOUR_IN_WINDOW;
}

/** Choose black vs red for the next spin: prefer alternating when it respects the 5-spin colour cap. */
function pickNextColourFamily(
  lastFamily: SuitFamily | null,
  lastFourFamilies: readonly SuitFamily[],
): SuitFamily {
  if (lastFamily === null) {
    const blackOk = canAddColourWithoutBreakingWindow(lastFourFamilies, 'black');
    const redOk = canAddColourWithoutBreakingWindow(lastFourFamilies, 'red');
    if (blackOk && redOk) return Math.random() < 0.5 ? 'black' : 'red';
    if (blackOk) return 'black';
    if (redOk) return 'red';
    return Math.random() < 0.5 ? 'black' : 'red';
  }

  const alt: SuitFamily = lastFamily === 'black' ? 'red' : 'black';
  const altOk = canAddColourWithoutBreakingWindow(lastFourFamilies, alt);
  const sameOk = canAddColourWithoutBreakingWindow(lastFourFamilies, lastFamily);

  if (altOk) return alt;
  if (sameOk) return lastFamily;
  return alt;
}

/** Pick a random id from `pool`, respecting the max-per-suit cap until all suits have appeared. */
function pickFromPool(pool: readonly number[], counts: Record<number, number>): number {
  if (allSuitsHaveAppearedOnce(counts)) {
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
  const underCap = pool.filter((id) => (counts[id] ?? 0) < MAX_PER_SUIT_BEFORE_ALL_SEEN);
  const choices = underCap.length > 0 ? underCap : [...pool];
  return choices[Math.floor(Math.random() * choices.length)]!;
}

function pickWinnerIndex(
  lastFamily: SuitFamily | null,
  counts: Record<number, number>,
  lastFourFamilies: readonly SuitFamily[],
): number {
  const targetFamily = pickNextColourFamily(lastFamily, lastFourFamilies);
  const pool = targetFamily === 'black' ? BLACK_POOL : RED_POOL;
  return pickFromPool(pool, counts);
}

function nextRotation(prev: number, winnerIndex: number, minFullTurns: number): number {
  const Cw = CENTER_DEG[winnerIndex];
  
  // Random offset between -38 and +38 degrees so it doesn't land exactly on the slice border
  const randomOffset = (Math.random() * 76) - 38;
  const targetDeg = Cw + randomOffset;
  
  const equiv = (360 - (((targetDeg % 360) + 360) % 360)) % 360;
  const prevNorm = ((prev % 360) + 360) % 360;
  let delta = equiv - prevNorm;
  if (delta <= 0) delta += 360;
  
  // Randomize the number of full turns to make the spin less predictable
  const extraTurns = Math.floor(Math.random() * 4); // 0 to 3 extra turns
  delta += 360 * (minFullTurns + extraTurns);
  
  return prev + delta;
}

const WHEEL_PATHS = [
  'M 100 100 L 100 0 A 100 100 0 0 1 200 100 Z',
  'M 100 100 L 200 100 A 100 100 0 0 1 100 200 Z',
  'M 100 100 L 100 200 A 100 100 0 0 1 0 100 Z',
  'M 100 100 L 0 100 A 100 100 0 0 1 100 0 Z',
];

/** Strong ease-out: fast start, long smooth deceleration before stop */
const SPIN_EASE: [number, number, number, number] = [0.08, 0.82, 0.12, 1];

function readBoolStorage(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch {
    return fallback;
  }
}

function writeBoolStorage(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function playTickSound(ctx: AudioContext, masterGain: number) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(920, t);
  osc.frequency.exponentialRampToValueAtTime(420, t + 0.04);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.085 * masterGain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

type Announcement = {
  key: number;
  id: number;
  name: string;
  symbol: string;
  family: SuitFamily;
};

export function SuitSpinWheel() {
  const reduceMotion = useReducedMotion();
  const lastFamilyRef = useRef<SuitFamily | null>(null);
  const pendingWinnerRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceSeqRef = useRef(0);
  const voiceOnRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  /** Primed on first Spin click so play() after the animation is not blocked as autoplay. */
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  /** Last spin colours (newest at end), for the 5-spin colour cap. */
  const colourHistoryRef = useRef<SuitFamily[]>([]);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [landBurst, setLandBurst] = useState(0);
  const [spinTime, setSpinTime] = useState(2.65);
  const [counts, setCounts] = useState<Record<number, number>>(() => ({
    ...INITIAL_COUNTS,
  }));

  const [ticksOn, setTicksOn] = useState(() =>
    readBoolStorage(STORAGE_TICKS, true),
  );
  const [voiceOn, setVoiceOn] = useState(() =>
    readBoolStorage(STORAGE_VOICE, true),
  );
  voiceOnRef.current = voiceOn;

  useEffect(() => {
    writeBoolStorage(STORAGE_TICKS, ticksOn);
  }, [ticksOn]);

  useEffect(() => {
    writeBoolStorage(STORAGE_VOICE, voiceOn);
  }, [voiceOn]);

  const clearTickInterval = useCallback(() => {
    if (tickIntervalRef.current !== null) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (tickStopRef.current !== null) {
      clearTimeout(tickStopRef.current);
      tickStopRef.current = null;
    }
  }, []);

  const spinDuration = reduceMotion ? 0.01 : spinTime;
  const minFullTurns = reduceMotion ? 1 : 5;

  const transition = reduceMotion
    ? { duration: 0.01 }
    : {
        type: 'tween' as const,
        duration: spinDuration,
        ease: SPIN_EASE,
      };

  const spin = useCallback(() => {
    if (spinning) return;
    const lastFourColours = colourHistoryRef.current.slice(-4);
    const winner = pickWinnerIndex(lastFamilyRef.current, counts, lastFourColours);
    const family = SEGMENTS[winner]!.family;
    lastFamilyRef.current = family;
    pendingWinnerRef.current = winner;
    
    const currentSpinTime = 2.4 + Math.random() * 1.2; // 2.4s to 3.6s
    setSpinTime(currentSpinTime);
    const activeSpinDuration = reduceMotion ? 0.01 : currentSpinTime;

    setAnnouncement(null);
    setSpinning(true);
    clearTickInterval();

    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch((e: unknown) =>
        console.error('[SuitWheel] AudioContext resume failed:', e),
      );
    }

    if (!voiceAudioRef.current) {
      const el = new Audio(voiceSrc);
      el.preload = 'auto';
      el.volume = 1;
      el.muted = true;
      el.load();
      voiceAudioRef.current = el;

      // Unlock playback on first user gesture so later voice playback is not blocked.
      void el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
        })
        .catch(() => {
          el.muted = false;
        });
    }

    if (ticksOn && !reduceMotion && activeSpinDuration > 0.1) {
      tickIntervalRef.current = setInterval(() => {
        const c = audioCtxRef.current;
        if (!c) return;
        if (c.state !== 'running') {
          void c.resume();
          return;
        }
        playTickSound(c, 0.12);
      }, 54);
      tickStopRef.current = setTimeout(() => {
        if (tickIntervalRef.current !== null) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
        tickStopRef.current = null;
      }, Math.max(0, activeSpinDuration * 1000 - 30));
    }

    setRotation((prev) => nextRotation(prev, winner, minFullTurns));
  }, [
    spinning,
    counts,
    ticksOn,
    reduceMotion,
    spinDuration,
    minFullTurns,
    clearTickInterval,
  ]);

  const onWheelAnimationComplete = useCallback(() => {
    const w = pendingWinnerRef.current;
    if (w === null) return;
    clearTickInterval();
    const seg = SEGMENTS[w]!;
    announceSeqRef.current += 1;
    setAnnouncement({
      key: announceSeqRef.current,
      id: seg.id,
      name: seg.name,
      symbol: seg.symbol,
      family: seg.family,
    });
    setCounts((c) => ({ ...c, [w]: (c[w] ?? 0) + 1 }));
    colourHistoryRef.current = [...colourHistoryRef.current, seg.family].slice(-32);
    setLandBurst((b) => b + 1);
    if (voiceOnRef.current) {
      const el = voiceAudioRef.current;
      if (!el) {
        console.warn(
          '[SuitWheel] Voice clip: no primed audio yet. Path should be:',
          voiceSrc,
          'BASE_URL:',
          import.meta.env.BASE_URL,
        );
      } else {
        el.currentTime = 0;
        void el.play().catch((err: unknown) =>
          console.error('[SuitWheel] Voice clip play failed:', err),
        );
      }
    }
    setSpinning(false);
    pendingWinnerRef.current = null;
  }, [clearTickInterval]);

  useEffect(() => () => clearTickInterval(), [clearTickInterval]);

  return (
    <div
      className="relative flex min-h-svh flex-col text-zinc-100"
      style={{
        background: `
          radial-gradient(ellipse 110% 70% at 50% -15%, rgba(129, 140, 248, 0.22), transparent 52%),
          radial-gradient(ellipse 90% 55% at 100% 60%, rgba(167, 139, 250, 0.18), transparent 48%),
          radial-gradient(ellipse 85% 50% at 0% 75%, rgba(59, 130, 246, 0.14), transparent 46%),
          linear-gradient(165deg, #020617 0%, #0f172a 28%, #1e1b4b 52%, #312e81 68%, #0a0a0f 100%)
        `,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 100%, rgba(15, 23, 42, 0.9), transparent 55%), radial-gradient(ellipse 50% 40% at 30% 20%, rgba(99, 102, 241, 0.08), transparent)',
        }}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6">
        <header className="text-center">
          <h1 className="text-balance font-semibold tracking-tight text-zinc-100 text-2xl sm:text-3xl">
            Trump Selector 
          </h1>
          <p className="mt-2 max-w-sm text-pretty text-sm text-zinc-500 sm:text-base">
          Kismat ka pahiya, Trump hai bhaiya!
          </p>
        </header>

        <div className="relative flex w-full max-w-[min(100%,22rem)] flex-col items-center gap-5">
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            aria-busy={spinning}
            aria-label={spinning ? 'Wheel is spinning' : 'Spin the suit wheel'}
            className="relative aspect-square w-full max-w-[min(85vmin,22rem)] cursor-pointer touch-manipulation border-0 bg-transparent p-0 text-inherit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-100"
          >
            <div
              className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1 pointer-events-none"
              aria-hidden
            >
              <motion.div
                key={landBurst}
                className="flex justify-center"
                style={{ transformOrigin: '50% 0%' }}
                initial={{ y: 0, rotate: 0 }}
                animate={
                  landBurst > 0
                    ? {
                        y: [0, -10, 4, -3, 0],
                        rotate: [0, -14, 7, -5, 0],
                      }
                    : { y: 0, rotate: 0 }
                }
                transition={{
                  duration: 0.52,
                  times: [0, 0.18, 0.42, 0.68, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="h-0 w-0 border-x-[10px] border-x-transparent border-t-[16px] border-t-fuchsia-400 drop-shadow-[0_0_12px_rgba(232,121,249,0.85)] sm:border-x-[12px] sm:border-t-[20px]" />
              </motion.div>
            </div>

            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-800/40 to-zinc-950 p-[3px] shadow-[0_0_0_1px_rgba(63,63,70,0.6),0_24px_60px_-12px_rgba(0,0,0,0.75)]">
              <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-zinc-700/60">
                <motion.div
                  className="absolute inset-0 will-change-transform"
                  style={{ transformOrigin: '50% 50%' }}
                  animate={{ rotate: rotation }}
                  transition={transition}
                  onAnimationComplete={onWheelAnimationComplete}
                >
                  <svg
                    viewBox="0 0 200 200"
                    className="h-full w-full"
                    aria-hidden
                    focusable="false"
                  >
                    <defs>
                      <filter id="neon" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="1.2" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {SEGMENTS.map((seg, i) => (
                      <path
                        key={seg.id}
                        d={WHEEL_PATHS[i]}
                        fill={seg.fill}
                        stroke={seg.stroke}
                        strokeWidth={2.25}
                        filter="url(#neon)"
                      />
                    ))}
                    {SEGMENTS.map((seg, i) => {
                      const angle = (i * 90 + 45) * (Math.PI / 180);
                      const r = 62;
                      const x = 100 + r * Math.sin(angle);
                      const y = 100 - r * Math.cos(angle);
                      return (
                        <text
                          key={`t-${seg.id}`}
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={`select-none text-[22px] font-semibold sm:text-[26px] ${seg.labelClass}`}
                          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                        >
                          {seg.symbol}
                        </text>
                      );
                    })}
                  </svg>
                </motion.div>

                <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]" />
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[18%] max-h-18 w-[18%] max-w-18 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-600/80 bg-zinc-900/95 shadow-[0_0_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]" />
          </button>

          <div className="flex w-full flex-col items-center gap-3">
            <button
              type="button"
              onClick={spin}
              disabled={spinning}
              aria-busy={spinning}
              className="h-[52px] w-full min-h-[52px] rounded-xl border border-cyan-500/40 bg-gradient-to-b from-cyan-500/20 to-teal-600/10 px-6 text-base font-semibold tracking-wide text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.2)] transition hover:border-cyan-400/60 hover:from-cyan-400/25 hover:shadow-[0_0_32px_rgba(34,211,238,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 sm:max-w-xs sm:self-center"
            >
              {spinning ? 'Spinning…' : 'Spin'}
            </button>
          </div>

          <div className="flex min-h-[7rem] w-full flex-col items-center justify-center px-1">
            <AnimatePresence mode="wait">
              {announcement && !spinning ? (
                <motion.div
                  key={announcement.key}
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                  transition={{
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="text-center"
                >
                  <p
                    className={`font-black tracking-tight text-5xl sm:text-6xl ${
                      announcement.family === 'red'
                        ? 'text-rose-100 drop-shadow-[0_0_24px_rgba(251,113,133,0.55)]'
                        : 'text-cyan-100 drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]'
                    }`}
                  >
                    {announcement.symbol}
                  </p>
                  <p className="mt-1 text-xl font-bold tracking-wide text-zinc-100 sm:text-2xl">
                    {announcement.name}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="w-full">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Spin history
            </p>
            <div className="grid w-full grid-cols-4 gap-2">
              {SEGMENTS.map((seg) => (
                <div
                  key={seg.id}
                  className={`rounded-xl border px-1 py-2 text-center ${
                    seg.family === 'red'
                      ? 'border-rose-500/35 bg-rose-950/40'
                      : 'border-cyan-500/30 bg-zinc-900/80'
                  }`}
                >
                  <div
                    className={`text-lg font-semibold leading-none sm:text-xl ${
                      seg.family === 'red' ? 'text-rose-200' : 'text-cyan-200'
                    }`}
                  >
                    {seg.symbol}
                  </div>
                  <div className="mt-1 tabular-nums text-lg font-bold text-zinc-100 sm:text-xl">
                    {counts[seg.id] ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex w-full flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 sm:text-sm"
            role="group"
            aria-label="Sound options"
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <input
                type="checkbox"
                checked={ticksOn}
                onChange={(e) => setTicksOn(e.target.checked)}
                className="size-4 rounded border-zinc-600 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-zinc-300">Tick sounds</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <input
                type="checkbox"
                checked={voiceOn}
                onChange={(e) => setVoiceOn(e.target.checked)}
                className="size-4 rounded border-zinc-600 text-fuchsia-500 focus:ring-fuchsia-500"
              />
              <span className="text-zinc-300">Voice</span>
            </label>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-zinc-800/80 py-4 text-center">
        <p className="text-xs text-slate-500 sm:text-sm">© 2026 Made by Lavish</p>
      </footer>
    </div>
  );
}
