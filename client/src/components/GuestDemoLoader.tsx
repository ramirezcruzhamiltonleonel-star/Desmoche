import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";
import LoadingScreen from "./LoadingScreen";

/**
 * Fires the moment a guest session connects — creates a private table,
 * fills it with 3 bots, and marks the guest ready, so a hand is already
 * dealt by the time this unmounts (Screens() switches to <GameTable/> once
 * `state` shows up). No lobby, no "listo" button, no setup screen.
 */
export default function GuestDemoLoader() {
  const { startInstantDemo } = useGame();
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    startInstantDemo().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Error desconocido");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="screen-fade flex min-h-screen flex-col items-center justify-center gap-3 bg-felt-dark px-4 text-center">
        <p className="text-sm text-red-300">No se pudo preparar la mesa: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gold px-4 py-2 text-sm text-gold hover:bg-gold/10"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return <LoadingScreen message="Preparando tu mesa contra bots..." />;
}
