import { useCallback, useState } from "react";

const STORAGE_KEY = "desmoche.soundEnabled";

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Real recorded sound effects (Mixkit — free for commercial use, no
 * attribution required) instead of the plain oscillator beeps this used to
 * synthesize. A fresh Audio() per play call rather than one shared/reused
 * element: these are all short one-shots that can legitimately overlap
 * (e.g. two melds placed in quick succession), and a reused element would
 * either cut the previous play off or need its own queue for no real
 * benefit here.
 */
const SOUND_FILES = {
  swoosh: "/sounds/swoosh.mp3",
  coin: "/sounds/coin.mp3",
  winFanfare: "/sounds/win-fanfare.mp3",
  click: "/sounds/click.mp3",
} as const;

export function useSound() {
  const [enabled, setEnabled] = useState<boolean>(loadEnabled);

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
    (file: keyof typeof SOUND_FILES, volume = 0.5) => {
      if (!enabled) return;
      try {
        const audio = new Audio(SOUND_FILES[file]);
        audio.volume = volume;
        // Autoplay restrictions (no prior user gesture yet) or a missing
        // file just mean this particular cue is silently skipped — sound
        // is always optional, never something an action waits on.
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    },
    [enabled],
  );

  return {
    enabled,
    toggle,
    /** Card leaving/entering a hand or the table — dealing, drawing, discarding, melding, desmochando. One shared "swoosh" for all card movement. */
    playDraw: () => play("swoosh"),
    playDiscard: () => play("swoosh"),
    playDeal: () => play("swoosh", 0.4),
    playMeld: () => play("swoosh", 0.6),
    playDesmochar: () => play("swoosh", 0.6),
    /** "Te toca a vos" — a short, distinct notification tick, not a card sound. */
    playTurn: () => play("click", 0.6),
    /** A plain hand-over with no auto-win/close-win bonus treatment (rare — see isAutoWinReason/isCloseWin in GameTable). */
    playWin: () => play("winFanfare", 0.5),
    /** Peladía / Cuatro Cuerpos — won on the deal alone, the game's most dramatic moment. */
    playAutoWin: () => play("winFanfare", 0.7),
    /** Closing the hand in one real play (meld-out/discard-out) — the biggest "you earned this" moment. */
    playCloseWin: () => play("winFanfare", 0.8),
    /** Chips changing hands at settlement. */
    playChipsPay: () => play("coin", 0.6),
  };
}
