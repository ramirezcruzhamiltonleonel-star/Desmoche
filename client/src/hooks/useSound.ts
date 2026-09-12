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

  return {
    enabled,
    toggle,
    playDraw: () => play(440, 90),
    playDiscard: () => play(280, 90),
    playWin: () => play(660, 320),
    playTurn: () => play(520, 140),
  };
}
