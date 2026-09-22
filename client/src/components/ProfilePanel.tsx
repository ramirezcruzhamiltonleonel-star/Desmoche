import { useEffect, useState } from "react";
import { claimDailyMission, fetchDailyProgress, fetchMyStats, type DailyProgress, type UserStats } from "../lib/api";
import Spinner from "./Spinner";

interface ProfilePanelProps {
  token: string;
  displayName: string;
  onClose: () => void;
}

export default function ProfilePanel({ token, displayName, onClose }: ProfilePanelProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [daily, setDaily] = useState<DailyProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justAwarded, setJustAwarded] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyStats(token)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido");
      });
    fetchDailyProgress(token)
      .then((result) => {
        if (!cancelled) setDaily(result);
      })
      .catch(() => {
        // Non-critical — the rest of the profile still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const result = await claimDailyMission(token);
      setJustAwarded(result.chipsAwarded);
      setDaily((prev) => (prev ? { ...prev, canClaim: false } : prev));
    } catch {
      // The mission may have already been claimed elsewhere (another tab) —
      // just refresh silently instead of showing a scary error for this.
      setDaily((prev) => (prev ? { ...prev, canClaim: false } : prev));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Perfil de {displayName}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-stone-300 hover:text-gold">
            ✕
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}

        {daily && (
          <div className="mb-4 space-y-2 rounded-lg border border-gold/40 bg-gold/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-200">🔥 Racha de días jugando</span>
              <span className="text-lg font-semibold text-gold">{daily.currentStreak}</span>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-stone-300">
                <span>🎯 Misión de hoy: {daily.mission.description}</span>
                <span className="tabular-nums text-stone-400">
                  {daily.mission.progress}/{daily.mission.target}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round((daily.mission.progress / daily.mission.target) * 100)}%` }}
                />
              </div>
              {justAwarded !== null ? (
                <p className="mt-2 text-center text-xs font-semibold text-green-400">
                  ¡+{justAwarded} fichas reclamadas!
                </p>
              ) : daily.canClaim ? (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="mt-2 w-full rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-50"
                >
                  {claiming ? "Reclamando..." : "🎁 Reclamar recompensa"}
                </button>
              ) : (
                daily.mission.completed && (
                  <p className="mt-2 text-center text-xs text-stone-400">Ya reclamada hoy — volvé mañana.</p>
                )
              )}
            </div>
          </div>
        )}

        {!stats && !error && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-stone-400">
            <Spinner size="sm" />
            <span>Cargando estadísticas...</span>
          </div>
        )}

        {stats && (
          <dl className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-gold/40 bg-gold/10 px-3 py-2">
              <dt className="text-sm text-stone-200">🃏 Mesas jugadas</dt>
              <dd className="text-lg font-semibold text-gold">{stats.tablesPlayed}</dd>
            </div>
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
            {stats.biggestWinChips !== null && (
              <div className="flex items-center justify-between rounded-lg bg-stone-900/60 px-3 py-2">
                <dt className="text-sm text-stone-300">🏆 Mejor mano</dt>
                <dd className="text-lg font-semibold text-gold">+{stats.biggestWinChips} fichas</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
