import type { ClientGameState } from "@desmoche/shared";
import { computeScoreboard } from "../lib/scoreboard";
import { REASON_LABELS } from "../lib/labels";

interface HandHistoryPanelProps {
  state: ClientGameState;
  nameByPlayerId: Record<string, string>;
  onClose: () => void;
}

export default function HandHistoryPanel({ state, nameByPlayerId, onClose }: HandHistoryPanelProps) {
  const scoreboard = computeScoreboard(state.handHistory, state.seats, state.ante);
  const showChips = state.stakeType === "chips" || state.stakeType === "money";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Historial de la mesa</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-stone-300 hover:text-gold">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-stone-900/60 p-3">
          <p className="mb-2 text-center text-[10px] uppercase tracking-wide text-stone-400">
            Marcador de la sesión
          </p>
          <table className="w-full text-sm">
            <tbody>
              {scoreboard.map((row) => (
                <tr key={row.playerId} className="text-stone-200">
                  <td className="py-0.5 pr-2">{row.displayName}</td>
                  <td className="py-0.5 pr-2 text-right text-stone-400">{row.handsWon} manos</td>
                  {showChips && (
                    <td
                      className={`py-0.5 text-right font-semibold ${
                        row.netChips > 0 ? "text-green-400" : row.netChips < 0 ? "text-red-400" : "text-stone-400"
                      }`}
                    >
                      {row.netChips > 0 ? "+" : ""}
                      {row.netChips}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-stone-400">Manos jugadas</p>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {state.handHistory.length === 0 && (
            <p className="text-center text-xs text-stone-500">Todavía no terminó ninguna mano.</p>
          )}
          {[...state.handHistory].reverse().map((entry, i) => {
            const handNumber = state.handHistory.length - i;
            const winnerSeat = state.seats.find((s) => s.seatIndex === entry.winnerSeatIndex);
            const winnerName = winnerSeat ? nameByPlayerId[winnerSeat.playerId] ?? "?" : "?";
            return (
              <div key={entry.playedAt} className="rounded-lg bg-stone-900/40 p-2 text-xs text-stone-300">
                <p className="font-semibold text-stone-100">
                  Mano {handNumber}: {REASON_LABELS[entry.reason] ?? entry.reason}
                </p>
                <p>Ganó {winnerName}</p>
                {entry.settlement.kind === "dare" && entry.settlement.playersWhoOweADare.length > 0 && (
                  <p className="text-stone-400">
                    Deben reto:{" "}
                    {entry.settlement.playersWhoOweADare.map((id) => nameByPlayerId[id] ?? id).join(", ")}
                  </p>
                )}
                {(entry.settlement.kind === "chips" || entry.settlement.kind === "money") && (
                  <p className="text-stone-400">Pozo: {entry.settlement.potWon}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
