import { useEffect, useState } from "react";
import { fetchMyStats, type UserStats } from "../lib/api";

interface ProfilePanelProps {
  token: string;
  displayName: string;
  onClose: () => void;
}

export default function ProfilePanel({ token, displayName, onClose }: ProfilePanelProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyStats(token)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Perfil de {displayName}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-stone-300 hover:text-gold">
            ✕
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}

        {!stats && !error && <p className="text-center text-sm text-stone-400">Cargando estadísticas...</p>}

        {stats && (
          <dl className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
              <dt className="text-sm text-stone-300">Manos jugadas</dt>
              <dd className="text-lg font-semibold text-stone-100">{stats.handsPlayed}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
              <dt className="text-sm text-stone-300">Manos ganadas</dt>
              <dd className="text-lg font-semibold text-gold">{stats.handsWon}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
              <dt className="text-sm text-stone-300">Micos/Patonas cobrados</dt>
              <dd className="text-lg font-semibold text-gold">{stats.handsWithBonus}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
              <dt className="text-sm text-stone-300">Fichas netas (histórico)</dt>
              <dd
                className={`text-lg font-semibold ${
                  stats.netChipsAllTime > 0
                    ? "text-green-400"
                    : stats.netChipsAllTime < 0
                      ? "text-red-400"
                      : "text-stone-400"
                }`}
              >
                {stats.netChipsAllTime > 0 ? "+" : ""}
                {stats.netChipsAllTime}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
