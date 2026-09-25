import { useState, type FormEvent } from "react";
import type { StakeType } from "@desmoche/shared";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import { STAKE_LABELS } from "../lib/labels";
import { readJoinCodeFromUrl } from "../lib/joinLink";
import CustomSelect from "./CustomSelect";
import ProfilePanel from "./ProfilePanel";
import Spinner from "./Spinner";

export default function HomeScreen() {
  const { user, token, isGuest, logout } = useAuth();
  const { createTable, joinTable, spectateTable, startInstantDemo } = useGame();
  // A shared join link (?mesa=CODE) lands here pre-filled on the "join" tab
  // instead of "create" — read once on mount, since the URL doesn't change
  // while this screen is up.
  const [sharedCode] = useState(() => readJoinCodeFromUrl());
  const [mode, setMode] = useState<"create" | "join" | "spectate">(sharedCode ? "join" : "create");
  const [stakeType, setStakeType] = useState<StakeType>("chips");
  const [ante, setAnte] = useState(100);
  const [autoWinsEnabled, setAutoWinsEnabled] = useState(true);
  const [allowMeldsBeforeResolvingDraw, setAllowMeldsBeforeResolvingDraw] = useState(false);
  const [code, setCode] = useState(sharedCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      await createTable(stakeType, stakeType === "chips" ? ante : 0, autoWinsEnabled, allowMeldsBeforeResolvingDraw);
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

  async function handleSpectate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await spectateTable(code.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  function handleModeChange(next: "create" | "join" | "spectate") {
    setMode(next);
    // Leftover error text and a typed code from one tab bleeding into
    // another (e.g. "No existe una mesa con ese código" still showing
    // after switching from Unirse to Ver mesa) was a reported bug.
    setCode("");
    setError(null);
  }

  async function handleInstantDemo() {
    setError(null);
    setBusy(true);
    try {
      await startInstantDemo();
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
              Hola, {user?.displayName}
              {isGuest ? " · invitado (sin fichas persistentes)" : ` · ${user?.chipBalance} fichas`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!isGuest && (
              <button onClick={() => setShowProfile(true)} className="text-xs text-stone-400 underline">
                Perfil
              </button>
            )}
            <button onClick={logout} className="text-xs text-stone-400 underline">
              Salir
            </button>
          </div>
        </div>

        {showProfile && token && !isGuest && (
          <ProfilePanel token={token} displayName={user?.displayName ?? ""} onClose={() => setShowProfile(false)} />
        )}

        <button
          onClick={handleInstantDemo}
          disabled={busy}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold px-6 py-5 text-xl font-bold text-stone-900 shadow-2xl transition hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? <Spinner size="sm" tone="dark" /> : "🎮"} Jugar ya
        </button>
        <p className="mb-4 text-center text-xs text-stone-400">
          Mesa instantánea contra bots · fichas · ante 50
        </p>

        {/* Open by default when a shared join link (?mesa=CODE) brought them
            here — they need the join form immediately, not tucked behind a
            summary they'd have to know to click. */}
        <details className="mb-4 group" open={Boolean(sharedCode)}>
          <summary className="cursor-pointer list-none text-center text-sm text-stone-400 underline decoration-dotted transition hover:text-stone-200">
            Opciones de mesa (crear con otras reglas, unirse a una de amigos, o mirar)
          </summary>

        <div className="mt-4 mb-4 flex rounded-lg border border-wood bg-felt p-1">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              mode === "create" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
            onClick={() => handleModeChange("create")}
          >
            Crear mesa
          </button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              mode === "join" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
            onClick={() => handleModeChange("join")}
          >
            Unirse
          </button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              mode === "spectate" ? "bg-gold text-stone-900" : "text-stone-300"
            }`}
            onClick={() => handleModeChange("spectate")}
          >
            Ver mesa
          </button>
        </div>

        <div className="rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
          {mode === "create" ? (
            <div className="space-y-4">
              <label className="block text-sm text-stone-200">
                Modo de apuesta
                <div className="mt-1">
                  <CustomSelect
                    value={stakeType}
                    onChange={setStakeType}
                    ariaLabel="Modo de apuesta"
                    triggerClassName="w-full justify-between px-3 py-2 text-sm"
                    disabledValues={["money"]}
                    options={[
                      { value: "chips", label: STAKE_LABELS.chips },
                      { value: "dare", label: STAKE_LABELS.dare },
                      { value: "money", label: STAKE_LABELS.money },
                    ]}
                  />
                </div>
              </label>
              {stakeType === "dare" && (
                <p className="rounded-lg bg-stone-900/60 px-3 py-2 text-xs text-stone-300">
                  Sin fichas ni ante — quien no gana la mano cumple un reto. El reto
                  específico no lo define la app: lo acuerdan entre ustedes antes de jugar.
                  Por eso no tiene sentido agregar bots a una mesa de Retos (un bot no puede
                  cumplir nada) — no vas a poder agregarlos aquí.
                </p>
              )}
              {stakeType === "chips" && (
                <label className="block text-sm text-stone-200">
                  Ante por mano
                  <input
                    type="number"
                    min={1}
                    value={ante}
                    onChange={(e) => setAnte(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-wood-dark bg-felt-dark px-3 py-2 text-stone-100"
                  />
                </label>
              )}
              <label className="flex items-start gap-2 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={!autoWinsEnabled}
                  onChange={(e) => setAutoWinsEnabled(!e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Modo sin automáticas
                  <span className="block text-xs text-stone-400">
                    Peladía y Cuatro Cuerpos no aplican — cada mano se juega completa.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={allowMeldsBeforeResolvingDraw}
                  onChange={(e) => setAllowMeldsBeforeResolvingDraw(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Regla de casa: bajar otros grupos antes de resolver la carta robada
                  <span className="block text-xs text-stone-400">
                    Podés bajar o extender grupos que no usan la carta que acabás de robar, antes de
                    usarla o descartarla. Variante que se juega en algunas mesas.
                  </span>
                </span>
              </label>
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-50"
              >
                {busy && <Spinner size="sm" tone="dark" />}
                {busy ? "Creando..." : "Crear mesa"}
              </button>
            </div>
          ) : mode === "join" ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <label className="block text-sm text-stone-200">
                Código de mesa
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-wood-dark bg-felt-dark px-3 py-2 text-center text-lg uppercase tracking-widest text-stone-100"
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
          ) : (
            <form onSubmit={handleSpectate} className="space-y-4">
              <p className="text-xs text-stone-400">
                Mirá una mesa de amigos sin participar — las cartas de los jugadores quedan ocultas
                hasta que las bajen. Solo funciona en mesas que ya empezaron a jugar.
              </p>
              <label className="block text-sm text-stone-200">
                Código de mesa
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-wood-dark bg-felt-dark px-3 py-2 text-center text-lg uppercase tracking-widest text-stone-100"
                  maxLength={6}
                  placeholder="ABCDE"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold px-4 py-2 font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-50"
              >
                {busy && <Spinner size="sm" tone="gold" />}
                {busy ? "Entrando..." : "👁 Ver mesa"}
              </button>
            </form>
          )}
          {error && <p className="mt-4 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>
        </details>
      </div>
    </div>
  );
}
