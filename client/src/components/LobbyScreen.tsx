import { useGame } from "../context/GameContext";
import { STAKE_LABELS } from "../lib/labels";

export default function LobbyScreen() {
  const { state, setReady, leaveTable } = useGame();
  if (!state) return null;
  const me = state.seats.find((s) => s.seatIndex === state.yourSeatIndex);

  return (
    <div className="screen-fade flex min-h-screen flex-col items-center justify-center bg-felt-dark px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
        <h2 className="mb-1 text-center font-display text-2xl text-gold">Sala de espera</h2>
        <p className="mb-1 text-center text-xs text-stone-400">
          {STAKE_LABELS[state.stakeType]}
          {state.stakeType === "chips" ? ` · ante ${state.ante}` : ""}
        </p>
        <p className="mb-4 text-center text-sm text-stone-300">
          Código: <span className="font-mono text-lg tracking-widest text-gold">{state.code}</span>
        </p>

        <ul className="mb-6 space-y-2">
          {state.seats.map((seat) => (
            <li
              key={seat.playerId}
              className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2"
            >
              <span className="text-stone-100">
                {seat.displayName}
                {!seat.connected && <span className="ml-2 text-xs text-red-400">(desconectado)</span>}
              </span>
              <span className={seat.ready ? "text-sm font-semibold text-green-400" : "text-sm text-stone-500"}>
                {seat.ready ? "Listo" : "Esperando"}
              </span>
            </li>
          ))}
          {state.seats.length < 2 && (
            <li className="rounded-lg border border-dashed border-stone-600 px-3 py-2 text-center text-sm text-stone-400">
              Esperando más jugadores (mínimo 2)...
            </li>
          )}
        </ul>

        <button
          onClick={() => setReady(!me?.ready)}
          className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
        >
          {me?.ready ? "Cancelar listo" : "Estoy listo"}
        </button>
        <button onClick={leaveTable} className="mt-3 w-full text-center text-xs text-stone-400 underline">
          Salir de la mesa
        </button>
      </div>
    </div>
  );
}
