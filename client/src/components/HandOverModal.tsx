import type { ClientHandOutcome, ClientHandSettlement } from "@desmoche/shared";
import { REASON_LABELS } from "../lib/labels";

interface HandOverModalProps {
  outcome: ClientHandOutcome;
  settlement: ClientHandSettlement | null;
  nameByPlayerId: Record<string, string>;
  winnerName: string;
  onNextHand: () => void;
}

export default function HandOverModal({
  outcome,
  settlement,
  nameByPlayerId,
  winnerName,
  onNextHand,
}: HandOverModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-gold bg-felt p-6 text-center shadow-2xl">
        <h3 className="mb-2 font-display text-2xl text-gold">
          {REASON_LABELS[outcome.reason] ?? "Mano terminada"}
        </h3>
        <p className="mb-4 text-sm text-stone-200">
          Gana <span className="font-semibold text-gold">{winnerName}</span>
        </p>

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
