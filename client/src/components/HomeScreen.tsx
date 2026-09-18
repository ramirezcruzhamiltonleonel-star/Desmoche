import { useState, type FormEvent } from "react";
import type { StakeType } from "@desmoche/shared";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import { STAKE_LABELS } from "../lib/labels";
import { readJoinCodeFromUrl } from "../lib/joinLink";
import ProfilePanel from "./ProfilePanel";
import Spinner from "./Spinner";

export default function HomeScreen() {
  const { user, token, logout } = useAuth();
  const { createTable, joinTable } = useGame();
  // A shared join link (?mesa=CODE) lands here pre-filled on the "join" tab
  // instead of "create" — read once on mount, since the URL doesn't change
  // while this screen is up.
  const [sharedCode] = useState(() => readJoinCodeFromUrl());
  const [mode, setMode] = useState<"create" | "join">(sharedCode ? "join" : "create");
  const [stakeType, setStakeType] = useState<StakeType>("chips");
  const [ante, setAnte] = useState(100);
  const [code, setCode] = useState(sharedCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      await createTable(stakeType, stakeType === "chips" ? ante : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await joinTable(code.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-fade min-h-screen bg-felt-dark px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-gold">Desmoche</h1>
            <p className="text-sm text-stone-300">
              Hola, {user?.displayName} · {user?.chipBalance} fichas
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button onClick={() => setShowProfile(true)} className="text-xs text-stone-400 underline">
              Perfil
            </button>
            <button onClick={logout} className="text-xs text-stone-400 underline">
              Salir
            </button>
          </div>
        </div>

        {showProfile && token && (
          <ProfilePanel token={token} displayName={user?.displayName ?? ""} onClose={() => setShowProfile(false)} />
        )}

        <div className="mb-4 flex rounded-lg border border-wood bg-felt p-1">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              mode === "create" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
            onClick={() => setMode("create")}
          >
            Crear mesa
          </button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              mode === "join" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
            onClick={() => setMode("join")}
          >
            Unirse por código
          </button>
        </div>

        <div className="rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
          {mode === "create" ? (
            <div className="space-y-4">
              <label className="block text-sm text-stone-200">
                Modo de apuesta
                <select
                  value={stakeType}
                  onChange={(e) => setStakeType(e.target.value as StakeType)}
                  className="mt-1 w-full rounded-lg border border-wood-dark bg-stone-900 px-3 py-2 text-stone-100"
                >
                  <option value="chips">{STAKE_LABELS.chips}</option>
                  <option value="dare">{STAKE_LABELS.dare}</option>
                  <option value="money" disabled>
                    {STAKE_LABELS.money}
                  </option>
                </select>
              </label>
              {stakeType === "chips" && (
                <label className="block text-sm text-stone-200">
                  Ante por mano
                  <input
                    type="number"
                    min={1}
                    value={ante}
                    onChange={(e) => setAnte(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-wood-dark bg-stone-900 px-3 py-2 text-stone-100"
                  />
                </label>
              )}
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-50"
              >
                {busy && <Spinner size="sm" tone="dark" />}
                {busy ? "Creando..." : "Crear mesa"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <label className="block text-sm text-stone-200">
                Código de mesa
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-wood-dark bg-stone-900 px-3 py-2 text-center text-lg uppercase tracking-widest text-stone-100"
                  maxLength={6}
                  placeholder="ABCDE"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-50"
              >
                {busy && <Spinner size="sm" tone="dark" />}
                {busy ? "Uniendo..." : "Unirse"}
              </button>
            </form>
          )}
          {error && <p className="mt-4 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>
      </div>
    </div>
  );
}
