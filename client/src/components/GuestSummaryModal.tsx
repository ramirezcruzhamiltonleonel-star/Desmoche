import type { GuestSessionSummary } from "../lib/guestSummary";

interface GuestSummaryModalProps {
  summary: GuestSessionSummary;
  onCreateAccount: () => void;
  onLeaveAnyway: () => void;
}

export default function GuestSummaryModal({ summary, onCreateAccount, onLeaveAnyway }: GuestSummaryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 text-center shadow-2xl">
        <h2 className="mb-1 font-display text-xl text-gold">Tu sesión como invitado</h2>
        <p className="mb-4 text-xs text-stone-400">Esto fue lo que hiciste jugando sin cuenta:</p>

        <dl className="mb-4 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
            <dt className="text-sm text-stone-300">Manos jugadas</dt>
            <dd className="text-lg font-semibold text-stone-100">{summary.gamesPlayed}</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
            <dt className="text-sm text-stone-300">Manos ganadas</dt>
            <dd className="text-lg font-semibold text-gold">{summary.gamesWon}</dd>
          </div>
          {summary.bestWinChips !== null && (
            <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
              <dt className="text-sm text-stone-300">Tu mejor mano</dt>
              <dd className="text-lg font-semibold text-gold">+{summary.bestWinChips} fichas</dd>
            </div>
          )}
        </dl>

        <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Jugaste como invitado — este progreso no se guarda. Si salís ahora, se pierde
          para siempre. Creá una cuenta gratis (correo + código) para que tus fichas y
          estadísticas queden guardadas de una vez.
        </p>

        <button
          onClick={onCreateAccount}
          className="mb-2 w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
        >
          Crear cuenta gratis
        </button>
        <button onClick={onLeaveAnyway} className="w-full text-center text-xs text-stone-400 underline">
          Salir de todas formas
        </button>
      </div>
    </div>
  );
}
