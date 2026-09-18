import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useGame } from "../context/GameContext";
import { STAKE_LABELS } from "../lib/labels";
import { buildJoinLink } from "../lib/joinLink";

export default function LobbyScreen() {
  const { state, setReady, leaveTable, addBot, removeBot } = useGame();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state) return;
    const link = buildJoinLink(state.code);
    QRCode.toDataURL(link, { margin: 1, width: 176, color: { dark: "#1c1917", light: "#e7e0c9" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [state?.code]);

  if (!state) return null;
  const me = state.seats.find((s) => s.seatIndex === state.yourSeatIndex);
  const isCreator = state.yourSeatIndex === 0;
  const canAddBot = isCreator && state.seats.length < 4;

  async function handleCopyLink() {
    if (!state) return;
    const link = buildJoinLink(state.code);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing else to do.
    }
  }

  return (
    <div className="screen-fade flex min-h-screen flex-col items-center justify-center bg-felt-dark px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
        <h2 className="mb-1 text-center font-display text-2xl text-gold">Sala de espera</h2>
        <p className="mb-1 text-center text-xs text-stone-400">
          {STAKE_LABELS[state.stakeType]}
          {state.stakeType === "chips" ? ` · ante ${state.ante}` : ""}
        </p>
        <p className="mb-3 text-center text-sm text-stone-300">
          Código: <span className="font-mono text-lg tracking-widest text-gold">{state.code}</span>
        </p>

        <div className="mb-5 flex flex-col items-center gap-2">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="Código QR para unirse a la mesa"
              className="h-28 w-28 rounded-lg border border-wood-dark sm:h-36 sm:w-36"
            />
          )}
          <button
            onClick={handleCopyLink}
            className="w-full rounded-lg border border-wood-dark bg-stone-900/60 px-3 py-1.5 text-xs font-semibold text-stone-200 transition hover:border-gold"
          >
            {copied ? "¡Enlace copiado!" : "Copiar enlace de mesa"}
          </button>
        </div>

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
              <span className="flex items-center gap-2">
                <span className={seat.ready ? "text-sm font-semibold text-green-400" : "text-sm text-stone-500"}>
                  {seat.ready ? "Listo" : "Esperando"}
                </span>
                {seat.isBot && isCreator && (
                  <button
                    onClick={() => removeBot(seat.playerId)}
                    className="text-xs text-stone-500 underline hover:text-red-400"
                  >
                    Quitar
                  </button>
                )}
              </span>
            </li>
          ))}
          {state.seats.length < 2 && (
            <li className="rounded-lg border border-dashed border-stone-600 px-3 py-2 text-center text-sm text-stone-400">
              Esperando más jugadores (mínimo 2)...
            </li>
          )}
        </ul>

        {canAddBot && (
          <button
            onClick={addBot}
            className="mb-3 w-full rounded-lg border border-dashed border-wood-dark px-4 py-2 text-sm text-stone-300 transition hover:border-gold hover:text-gold"
          >
            🤖 Agregar bot
          </button>
        )}

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
