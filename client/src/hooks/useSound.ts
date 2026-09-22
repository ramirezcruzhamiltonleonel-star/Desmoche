import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "desmoche.soundEnabled";

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Tiny beeps via the Web Audio API — no audio assets to ship or load. */
export function useSound() {
  const [enabled, setEnabled] = useState<boolean>(loadEnabled);
  const ctxRef = useRef<AudioContext | null>(null);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const play = useCallback(
    (frequency: number, durationMs: number) => {
      if (!enabled) return;
      try {
        const ctx = ctxRef.current ?? new AudioContext();
        ctxRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
      } catch {
        // Autoplay restrictions or no Web Audio support — sound is optional.
      }
    },
    [enabled],
  );

  const playSequence = useCallback(
    (frequencies: number[], durationMs: number, gapMs: number) => {
      frequencies.forEach((f, i) => setTimeout(() => play(f, durationMs), i * gapMs));
    },
    [play],
  );

  return {
    enabled,
    toggle,
    playDraw: () => play(440, 90),
    playDiscard: () => play(280, 90),
    playWin: () => play(660, 320),
    playTurn: () => play(520, 140),
    /**
     * A meld landing successfully — a short bright rising chime, more
     * "that's right!" than the plain single beep it used to be, since this
     * is the main positive-reinforcement moment for someone still learning
     * which combinations are valid.
     */
    playMeld: () => playSequence([600, 760, 920], 70, 55),
    /** Desmoche succeeding — a rising two-note chime, brighter than the old flat pair. */
    playDesmochar: () => playSequence([500, 700], 80, 65),
    playDeal: () => playSequence([380, 440, 500, 560], 60, 50),
    /**
     * Peladía / Cuatro Cuerpos — won on the deal alone, the most dramatic
     * moments in the game. A fanfare distinct from the plain playWin():
     * a quick rising run into a sustained high note, not just one beep.
     */
    playAutoWin: () => {
      playSequence([440, 550, 660, 880], 70, 65);
      setTimeout(() => play(1100, 500), 300);
    },
    /**
     * Closing the hand in one real play (meld-out/discard-out) — the
     * biggest, most "you earned this" celebration in the game, distinct
     * from both the plain playWin() (used elsewhere) and playAutoWin()
     * (a deal-luck win, not a played one): a longer rising run into a
     * two-note triumphant flourish at the top.
     */
    playCloseWin: () => {
      playSequence([440, 523, 587, 659, 784, 880], 65, 60);
      setTimeout(() => play(1047, 150), 420);
      setTimeout(() => play(1319, 600), 540);
    },
    /** A short, bright multi-tone "clink" for chips changing hands at settlement — distinct timbre (shorter, higher, more clustered) from every other cue so it reads as "money", not another meld/turn/win beep. */
    playChipsPay: () => playSequence([1400, 1600, 1800], 40, 35),
  };
}
