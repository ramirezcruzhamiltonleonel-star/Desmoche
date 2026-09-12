import { useGame } from "../context/GameContext";

export default function ErrorToast() {
  const { lastError, dismissError } = useGame();
  if (!lastError) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex max-w-sm items-center gap-3 rounded-lg border border-red-700 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-xl">
        <span className="flex-1">{lastError}</span>
        <button onClick={dismissError} className="text-red-300 hover:text-red-100" aria-label="Cerrar">
          ✕
        </button>
      </div>
    </div>
  );
}
