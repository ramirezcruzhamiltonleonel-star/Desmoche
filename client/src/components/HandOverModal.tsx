import { useEffect, useRef, useState } from "react";
import {
  bonusesAppliedThisHand,
  isAutoWinReason,
  REACTION_EMOJIS,
  type BonusKind,
  type ClientHandOutcome,
  type ClientHandSettlement,
  type ReactionEmoji,
} from "@desmoche/shared";
import { useSound } from "../hooks/useSound";
import { hasSeenBonus, markBonusSeen } from "../lib/bonusSeenTracker";
import { generateReplayGif } from "../lib/generateReplayGif";
import { REASON_LABELS } from "../lib/labels";
import Confetti from "./Confetti";
import ReplayScenes, { REPLAY_SCENE_HOLDS_MS } from "./ReplayScenes";

/** Animates from 0 up to `value` over ~1.1s — used for the pot-won number on a real close, so it reads as "you just earned this" instead of a static line of text. */
function useCountUp(value: number, active: boolean): number {
  const [display, setDisplay] = useState(active ? 0 : value);
  useEffect(() => {
    if (!active) {
      setDisplay(value);
      return undefined;
    }
    const durationMs = 1100;
    const startedAt = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      setDisplay(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, active]);
  return display;
}

const BONUS_TITLES: Record<BonusKind, string> = {
  peladia: "¿Qué es una Peladía?",
  "cuatro-cuerpos": "¿Qué es Cuatro Cuerpos?",
  mico: "¿Qué es el bono Mico?",
  patona: "¿Qué es el bono Patona?",
};

const BONUS_EXPLANATIONS: Record<BonusKind, string> = {
  peladia:
    'Ganaste de inmediato porque tu mano recién repartida no tenía ni pares ni 2 o más cartas seguidas del mismo palo — una mano "pelada" así gana en el acto, antes de que nadie juegue.',
  "cuatro-cuerpos":
    "Te repartieron las 4 cartas del mismo valor (por ejemplo, los cuatro 8) — eso gana la mano de inmediato, igual que una Peladía.",
  mico: 'Tu jugada ganadora incluye una escalera A-2-3 o Q-K-A del mismo palo (un "Mico") — por eso cada perdedor te paga un ante extra, además del pozo normal.',
  patona:
    'Quien no bajó ningún grupo en toda la mano debe un ante extra por "Patona", además de lo que ya debía por el pozo — se acumula con el Mico si también aplica.',
};

interface HandOverModalProps {
  outcome: ClientHandOutcome;
  settlement: ClientHandSettlement | null;
  nameByPlayerId: Record<string, string>;
  winnerName: string;
  onNextHand: () => void;
  /** Omitted for spectators — reacting to a hand you didn't play doesn't make sense here. */
  onReact?: (emoji: ReactionEmoji) => void;
}

export default function HandOverModal({
  outcome,
  settlement,
  nameByPlayerId,
  winnerName,
  onNextHand,
  onReact,
}: HandOverModalProps) {
  const [justSent, setJustSent] = useState<ReactionEmoji | null>(null);
  const isAutoWin = isAutoWinReason(outcome.reason);
  // "Efecto Desmoche": closing the hand in one real play (not a deal-luck
  // auto-win, not the no-winner stock-exhausted case) is the single biggest
  // moment a player can have — confetti + a bigger sound + a counting-up
  // pot, distinct from the calmer auto-win and plain treatments.
  const isCloseWin = outcome.reason === "meld-out" || outcome.reason === "discard-out";
  const potWon = settlement && (settlement.kind === "chips" || settlement.kind === "money") ? settlement.potWon : 0;
  const animatedPot = useCountUp(potWon, isCloseWin);
  const sound = useSound();
  useEffect(() => {
    if (potWon > 0) sound.playChipsPay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const appliedBonuses = bonusesAppliedThisHand(outcome, settlement);
  const micoApplies = appliedBonuses.includes("mico");
  // Captured once, at the moment this modal first appears for this hand —
  // "first time" is evaluated exactly once per hand-over, not re-checked on
  // every re-render (which would flicker back to "already seen" the instant
  // markBonusSeen runs).
  const [firstTimeBonuses] = useState<BonusKind[]>(() => appliedBonuses.filter((kind) => !hasSeenBonus(kind)));
  useEffect(() => {
    for (const kind of firstTimeBonuses) markBonusSeen(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shareable replay GIF — only offered for a real close (the moment worth
  // sharing), built from a handful of static "scenes" (see ReplayScenes),
  // never a true recording of the live animation.
  const replayContainerRef = useRef<HTMLDivElement>(null);
  const [replayScene, setReplayScene] = useState(0);
  const [replayStatus, setReplayStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [replayProgress, setReplayProgress] = useState(0);

  async function handleGenerateReplay() {
    if (!replayContainerRef.current) return;
    setReplayStatus("generating");
    setReplayProgress(0);
    try {
      const scenes = REPLAY_SCENE_HOLDS_MS.map((holdMs) => ({ holdMs }));
      const blob = await generateReplayGif(
        replayContainerRef.current,
        scenes,
        setReplayScene,
        setReplayProgress,
      );
      setReplayUrl(URL.createObjectURL(blob));
      setReplayStatus("ready");
    } catch {
      setReplayStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      {isCloseWin && <Confetti />}
      <div
        className={`w-full max-w-sm rounded-2xl border-4 bg-felt p-6 text-center shadow-2xl ${
          isAutoWin || isCloseWin ? "pending-draw-glow border-gold" : "border-gold"
        }`}
      >
        <h3 className={`mb-2 font-display text-gold ${isAutoWin || isCloseWin ? "text-3xl" : "text-2xl"}`}>
          {(isAutoWin || isCloseWin) && "⚡ "}
          {REASON_LABELS[outcome.reason] ?? "Mano terminada"}
          {(isAutoWin || isCloseWin) && " ⚡"}
        </h3>
        {isAutoWin && (
          <p className="mb-2 text-xs uppercase tracking-widest text-gold/80">¡Victoria automática al reparto!</p>
        )}
        {isCloseWin && (
          <p className="mb-2 text-xs uppercase tracking-widest text-gold/80">¡Se la comió completa!</p>
        )}
        {outcome.winnerSeatIndex !== null ? (
          <p className="mb-4 text-sm text-stone-200">
            Gana <span className="font-semibold text-gold">{winnerName}</span>
          </p>
        ) : (
          <p className="mb-4 text-sm text-stone-300">Nadie completó su mano — se reparte otra vez.</p>
        )}

        {firstTimeBonuses.length > 0 && (
          <div className="mb-4 space-y-2 rounded-lg border border-gold/40 bg-gold/5 p-3 text-left">
            {firstTimeBonuses.map((kind) => (
              <div key={kind}>
                <p className="text-xs font-semibold text-gold">{BONUS_TITLES[kind]}</p>
                <p className="text-xs text-stone-300">{BONUS_EXPLANATIONS[kind]}</p>
              </div>
            ))}
          </div>
        )}

        {settlement && settlement.kind === "carry-over" && (
          <div className="mb-4 space-y-1 text-sm text-stone-300">
            {settlement.addedToPot > 0 ? (
              <p>
                Este pozo se acumula ("se va doble"): cada quien vuelve a poner su ante en la próxima
                mano, sumado a lo ya acumulado.
              </p>
            ) : (
              <p>No hay pozo que acumular en modo Retos — la próxima mano empieza de cero.</p>
            )}
            {settlement.totalAccumulatedPot > 0 && (
              <p className="text-xs">
                Pozo acumulado hasta ahora:{" "}
                <span className="font-semibold text-gold">{settlement.totalAccumulatedPot}</span>
              </p>
            )}
          </div>
        )}

        {settlement && settlement.kind === "dare" && settlement.playersWhoOweADare.length > 0 && (
          <div className="mb-4 space-y-1 text-sm text-stone-300">
            <p className="text-[10px] uppercase tracking-wide text-stone-400">
              Deben cumplir el reto que acordaron entre ustedes
            </p>
            {settlement.playersWhoOweADare.map((playerId) => (
              <p key={playerId} className="font-semibold text-stone-100">
                {nameByPlayerId[playerId] ?? playerId}
              </p>
            ))}
          </div>
        )}

        {settlement && (settlement.kind === "chips" || settlement.kind === "money") && (
          <div className="mb-4 space-y-1 text-sm text-stone-300">
            <p>
              Pozo ganado:{" "}
              <span className={`font-semibold text-gold ${isCloseWin ? "text-lg tabular-nums" : ""}`}>
                {isCloseWin ? animatedPot : settlement.potWon}
              </span>
            </p>
            {Object.entries(settlement.extraPerLoser).some(([, extra]) => extra > 0) && (
              <div className="text-xs">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-stone-400">Bono extra</p>
                {Object.entries(settlement.extraPerLoser)
                  .filter(([, extra]) => extra > 0)
                  .map(([playerId, extra]) => {
                    const isPatona = settlement.patonaLoserIds.includes(playerId);
                    const reason = isPatona && micoApplies ? "Mico + Patona" : isPatona ? "Patona" : "Mico";
                    return (
                      <p key={playerId}>
                        {nameByPlayerId[playerId] ?? playerId} paga {extra} extra
                        <span className="text-stone-500"> ({reason})</span>
                      </p>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {onReact && (
          <div className="mb-4 flex justify-center gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji);
                  setJustSent(emoji);
                }}
                aria-label={`Reaccionar con ${emoji}`}
                className={`rounded-full border px-2.5 py-1.5 text-lg transition ${
                  justSent === emoji
                    ? "border-gold bg-gold/20"
                    : "border-stone-600 hover:border-gold hover:bg-gold/10"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {isCloseWin && (
          <div className="mb-3">
            {replayStatus === "ready" && replayUrl ? (
              <a
                href={replayUrl}
                download="desmoche-victoria.gif"
                className="block w-full rounded-lg border border-gold px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10"
              >
                🎬 Descargar GIF para compartir
              </a>
            ) : (
              <button
                onClick={handleGenerateReplay}
                disabled={replayStatus === "generating"}
                className="w-full rounded-lg border border-gold px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-50"
              >
                {replayStatus === "generating"
                  ? `Generando GIF... ${Math.round(replayProgress * 100)}%`
                  : replayStatus === "error"
                    ? "No se pudo generar — tocá para reintentar"
                    : "🎬 Crear GIF de esta victoria"}
              </button>
            )}
          </div>
        )}

        <button
          onClick={onNextHand}
          className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
        >
          Siguiente mano
        </button>
      </div>

      {isCloseWin && (
        // Off-screen (not display:none/visibility:hidden — those break
        // html-to-image's capture) — never actually shown to the player,
        // only ever screenshotted scene by scene into the GIF.
        <div className="fixed left-[-9999px] top-0" aria-hidden>
          <div ref={replayContainerRef} className="h-[640px] w-[400px] overflow-hidden">
            <ReplayScenes scene={replayScene} outcome={outcome} settlement={settlement} winnerName={winnerName} />
          </div>
        </div>
      )}
    </div>
  );
}
