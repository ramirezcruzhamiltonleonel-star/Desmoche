import { useEffect, useState } from "react";
import type { ClientClaimView } from "@desmoche/shared";
import Card from "./Card";

/**
 * Must match CLAIM_WINDOW_MS in server/src/index.ts — the server is the
 * actual authority (this is purely a visual countdown, force-resolved
 * server-side regardless of what this shows), but keeping the number in
 * sync avoids the countdown hitting zero while the window is still open,
 * or vice versa. Confirmed live in production this round: a window with
 * zero input stayed open for exactly 30006ms.
 */
const CLAIM_WINDOW_MS = 30_000;

interface ClaimBannerProps {
  claim: ClientClaimView;
  isEligible: boolean;
  /** Whether the card would genuinely fit right now — checked with the exact same rule the server enforces, so "Sí me sirve" is never clickable only to get rejected. */
  canClaim: boolean;
  onRespond: (response: "claim" | "pass") => void;
  /** Set only the very first time in this session/account a claim is genuinely useful — explains WHY, then never shows again once the player's seen it. */
  firstClaimHint?: string | null;
}

export default function ClaimBanner({ claim, isEligible, canClaim, onRespond, firstClaimHint }: ClaimBannerProps) {
  // This component remounts (see the `key` on it in GameTable.tsx) every time
  // a genuinely new card is offered, so a plain mount-time timestamp is
  // enough — no need to track the previous card here at all.
  const [remainingMs, setRemainingMs] = useState(CLAIM_WINDOW_MS);
  useEffect(() => {
    const openedAt = Date.now();
    const tick = () => setRemainingMs(Math.max(0, CLAIM_WINDOW_MS - (Date.now() - openedAt)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const fractionLeft = remainingMs / CLAIM_WINDOW_MS;

  return (
    // Floating overlay, not a block in normal flow — it used to sit between
    // the felt and the hand tray, PUSHING the hand down every time a claim
    // window opened (reported bug: the hand's position wasn't stable). Fixed
    // positioning just below the header means it never reflows anything
    // else, and the hand tray (always at the bottom) stays exactly where it
    // was regardless of whether this is showing.
    // Redesigned for legibility (reported: too small, low contrast, "looks
    // like a plain text banner, not a casino element"): a real title line
    // of its own instead of crammed next to the card, a big bold countdown
    // instead of tiny gray digits, a richer felt-to-black gradient with a
    // thicker gold frame, and bigger buttons.
    <div className="fixed left-1/2 top-1 z-40 w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border-4 border-gold bg-gradient-to-b from-felt-dark to-black p-4 shadow-2xl">
      <p className="mb-3 text-center font-display text-xl font-bold text-gold [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
        ¿Alguien quiere esta carta?
      </p>
      <div className="mb-3 flex items-center justify-center gap-5">
        <Card card={claim.card} size="md" />
        <div className="flex flex-col items-center leading-none">
          <span className="font-mono text-4xl font-bold tabular-nums text-gold [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
            {remainingSeconds}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-stone-300">segundos</span>
        </div>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-700">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.max(0, Math.min(1, fractionLeft)) * 100}%` }}
        />
      </div>
      {isEligible ? (
        <div className="flex flex-col items-center gap-2.5">
          {firstClaimHint && canClaim && (
            <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-center text-sm text-gold">
              💡 {firstClaimHint}
            </p>
          )}
          <div className="flex w-full justify-center gap-3">
            <button
              onClick={() => onRespond("claim")}
              disabled={!canClaim}
              title={canClaim ? undefined : "Esa carta no te sirve de inmediato en ningún grupo"}
              className="rounded-lg bg-gold px-6 py-2.5 text-base font-bold text-stone-900 shadow-lg transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-gold"
            >
              Sí me sirve
            </button>
            <button
              onClick={() => onRespond("pass")}
              className="rounded-lg border-2 border-stone-400 px-6 py-2.5 text-base font-bold text-stone-100 transition hover:border-stone-200"
            >
              No me sirve
            </button>
          </div>
          {!canClaim && (
            <p className="text-center text-xs text-stone-300">
              Esa carta no te sirve de inmediato en ningún grupo.
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-stone-300">Esperando a los demás jugadores...</p>
      )}
    </div>
  );
}
