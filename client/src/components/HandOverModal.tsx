import { useState } from "react";
import {
  isAutoWinReason,
  REACTION_EMOJIS,
  type ClientHandOutcome,
  type ClientHandSettlement,
  type ReactionEmoji,
} from "@desmoche/shared";
import { REASON_LABELS } from "../lib/labels";

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
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div
        className={`w-full max-w-sm rounded-2xl border-4 bg-felt p-6 text-center shadow-2xl ${
          isAutoWin ? "pending-draw-glow border-gold" : "border-gold"
        }`}
      >
        <h3 className={`mb-2 font-display text-gold ${isAutoWin ? "text-3xl" : "text-2xl"}`}>
          {isAutoWin && "⚡ "}
          {REASON_LABELS[outcome.reason] ?? "Mano terminada"}
          {isAutoWin && " ⚡"}
        </h3>
        {isAutoWin && (
          <p className="mb-2 text-xs uppercase tracking-widest text-gold/80">¡Victoria automática al reparto!</p>
        )}
        {outcome.winnerSeatIndex !== null ? (
          <p className="mb-4 text-sm text-stone-200">
            Gana <span className="font-semibold text-gold">{winnerName}</span>
          </p>
        ) : (
          <p className="mb-4 text-sm text-stone-300">Nadie completó su mano — se reparte otra vez.</p>
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
            <p className="text-[10px] uppercase tracking-wide text-stone-400">Deben cumplir su reto</p>
            {settlement.playersWhoOweADare.map((playerId) => (
              <p key={playerId}>{nameByPlayerId[playerId] ?? playerId}</p>
            ))}
          </div>
        )}

        {settlement && (settlement.kind === "chips" || settlement.kind === "money") && (
          <div className="mb-4 space-y-1 text-sm text-stone-300">
            <p>
              Pozo ganado: <span className="font-semibold text-gold">{settlement.potWon}</span>
            </p>
            {Object.entries(settlement.extraPerLoser).some(([, extra]) => extra > 0) && (
              <div className="text-xs">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-stone-400">Bono Mico</p>
                {Object.entries(settlement.extraPerLoser)
                  .filter(([, extra]) => extra > 0)
                  .map(([playerId, extra]) => (
                    <p key={playerId}>
                      {nameByPlayerId[playerId] ?? playerId} paga {extra} extra
                    </p>
                  ))}
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

        <button
          onClick={onNextHand}
          className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
        >
          Siguiente mano
        </button>
      </div>
    </div>
  );
}
