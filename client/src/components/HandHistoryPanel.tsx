import { useState } from "react";
import { formatMeldCommentary, type Card as CardModel, type ClientGameState, type TableEventType } from "@desmoche/shared";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { computeScoreboard } from "../lib/scoreboard";
import { EVENT_TYPE_LABELS, REASON_LABELS } from "../lib/labels";

interface HandHistoryPanelProps {
  state: ClientGameState;
  nameByPlayerId: Record<string, string>;
  onClose: () => void;
}

const SUIT_SYMBOL: Record<CardModel["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

function cardText(card: CardModel): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

type EventFilter = "all" | TableEventType;

const FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "claimed-discard", label: "Robó del bote" },
  { value: "desmocho", label: "Desmoche" },
  { value: "peladia", label: "Peladía / Cuatro Cuerpos" },
  { value: "auto-extend", label: "Se agregó a un grupo" },
  { value: "meld-placed", label: "Grupos bajados" },
  { value: "retired", label: "Retiros" },
];

export default function HandHistoryPanel({ state, nameByPlayerId, onClose }: HandHistoryPanelProps) {
  useEscapeKey(onClose);
  const scoreboard = computeScoreboard(state.handHistory, state.seats, state.ante);
  const showChips = state.stakeType === "chips" || state.stakeType === "money";
  const [view, setView] = useState<"hands" | "events">("hands");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");

  const nameBySeatIndex = Object.fromEntries(
    state.seats.map((s) => [s.seatIndex, nameByPlayerId[s.playerId] ?? "?"]),
  );
  const filteredEvents = state.eventLog.filter((event) => {
    if (eventFilter === "all") return true;
    if (eventFilter === "peladia") return event.type === "peladia" || event.type === "cuatro-cuerpos";
    return event.type === eventFilter;
  });

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
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-stone-500">
                <th className="pb-1 text-left font-normal">Jugador</th>
                <th className="pb-1 pr-2 text-right font-normal">Manos ganadas</th>
                {showChips && <th className="pb-1 text-right font-normal">Fichas ganadas/perdidas</th>}
              </tr>
            </thead>
            <tbody>
              {scoreboard.map((row) => (
                <tr key={row.playerId} className="text-stone-200">
                  <td className="py-0.5 pr-2">{row.displayName}</td>
                  <td className="py-0.5 pr-2 text-right text-stone-400">{row.handsWon}</td>
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

        <div className="mb-2 flex rounded-lg border border-wood-dark bg-stone-900/60 p-0.5 text-xs">
          <button
            onClick={() => setView("hands")}
            className={`flex-1 rounded-md py-1 font-semibold transition ${
              view === "hands" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
          >
            Manos jugadas
          </button>
          <button
            onClick={() => setView("events")}
            className={`flex-1 rounded-md py-1 font-semibold transition ${
              view === "events" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
          >
            Eventos
          </button>
        </div>

        {view === "events" && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEventFilter(opt.value)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                  eventFilter === opt.value
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-stone-600 text-stone-400 hover:border-stone-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {view === "hands" &&
            (state.handHistory.length === 0 ? (
              <p className="text-center text-xs text-stone-500">Todavía no terminó ninguna mano.</p>
            ) : (
              [...state.handHistory].reverse().map((entry, i) => {
                const handNumber = state.handHistory.length - i;
                const winnerSeat = state.seats.find((s) => s.seatIndex === entry.winnerSeatIndex);
                const winnerName = winnerSeat ? nameByPlayerId[winnerSeat.playerId] ?? "?" : null;
                return (
                  <div key={entry.playedAt} className="rounded-lg bg-stone-900/40 p-2 text-xs text-stone-300">
                    <p className="font-semibold text-stone-100">
                      Mano {handNumber}: {REASON_LABELS[entry.reason] ?? entry.reason}
                    </p>
                    {winnerName ? <p>Ganó {winnerName}</p> : <p>Nadie ganó — el pozo se acumula</p>}
                    {entry.settlement.kind === "dare" && entry.settlement.playersWhoOweADare.length > 0 && (
                      <>
                        {entry.settlement.winnerReto && (
                          <p className="italic text-stone-400">"{entry.settlement.winnerReto}"</p>
                        )}
                        <p className="text-stone-400">
                          Deben reto:{" "}
                          {entry.settlement.playersWhoOweADare.map((id) => nameByPlayerId[id] ?? id).join(", ")}
                        </p>
                      </>
                    )}
                    {(entry.settlement.kind === "chips" || entry.settlement.kind === "money") && (
                      <p className="text-stone-400">Pozo: {entry.settlement.potWon}</p>
                    )}
                    {entry.settlement.kind === "carry-over" && entry.settlement.addedToPot > 0 && (
                      <p className="text-stone-400">
                        Pozo acumulado tras esta mano: {entry.settlement.totalAccumulatedPot}
                      </p>
                    )}
                  </div>
                );
              })
            ))}

          {view === "events" &&
            (filteredEvents.length === 0 ? (
              <p className="text-center text-xs text-stone-500">Nada que mostrar todavía con este filtro.</p>
            ) : (
              [...filteredEvents].reverse().map((event, i) => (
                <div
                  key={`${event.type}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-stone-900/40 p-2 text-xs text-stone-300"
                >
                  <span>
                    <span className="font-semibold text-stone-100">{nameBySeatIndex[event.seatIndex] ?? "?"}</span>
                    {" — "}
                    {event.type === "meld-placed"
                      ? `Bajó ${formatMeldCommentary(event.meldType, event.cards)}`
                      : (EVENT_TYPE_LABELS[event.type] ?? event.type)}
                  </span>
                  {(event.type === "claimed-discard" ||
                    event.type === "desmocho" ||
                    event.type === "auto-extend") && (
                    <span className="font-mono text-gold">{cardText(event.card)}</span>
                  )}
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
