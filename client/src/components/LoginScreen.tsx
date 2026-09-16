import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

export default function LoginScreen() {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await requestCode(email);
      setDevCode(result.devCode);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyCode(email, code, displayName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-fade flex min-h-screen items-center justify-center bg-felt-dark px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
        <h1 className="mb-1 text-center font-display text-3xl text-gold">Desmoche</h1>
        <p className="mb-6 text-center text-sm text-stone-300">Mesa de cartas nicaragüense</p>

        {step === "email" ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <label className="block text-sm text-stone-200">
              Correo electrónico
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wood-dark bg-stone-900 px-3 py-2 text-stone-100 outline-none focus:border-gold"
                placeholder="tu@correo.com"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-50"
            >
              {busy && <Spinner size="sm" tone="dark" />}
              {busy ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-stone-300">
              Enviamos un código a <span className="text-gold">{email}</span>.
            </p>
            {devCode && (
              <p className="rounded-lg bg-stone-800 px-3 py-2 text-xs text-stone-300">
                Modo desarrollo (sin proveedor de correo aún) — código:{" "}
                <span className="font-mono text-gold">{devCode}</span>
              </p>
            )}
            <label className="block text-sm text-stone-200">
              Código de 6 dígitos
              <input
                inputMode="numeric"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wood-dark bg-stone-900 px-3 py-2 text-center text-lg tracking-widest text-stone-100 outline-none focus:border-gold"
                placeholder="000000"
                maxLength={6}
              />
            </label>
            <label className="block text-sm text-stone-200">
              Tu nombre (solo la primera vez)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wood-dark bg-stone-900 px-3 py-2 text-stone-100 outline-none focus:border-gold"
                placeholder="Ej. Ana"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-50"
            >
              {busy && <Spinner size="sm" tone="dark" />}
              {busy ? "Verificando..." : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="w-full text-center text-xs text-stone-400 underline"
            >
              Usar otro correo
            </button>
          </form>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-200">{error}</p>}
      </div>
    </div>
  );
}
