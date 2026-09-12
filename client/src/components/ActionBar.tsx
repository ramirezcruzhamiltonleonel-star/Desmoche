import type { Card as CardModel, Meld } from "@desmoche/shared";

interface DesmocheSource {
  meldId: string;
  card: CardModel;
}

interface ActionBarProps {
  isYourTurn: boolean;
  canDraw: boolean;
  onDraw: () => void;
  canAct: boolean;
  selectedCount: number;
  onPlaceMeld: () => void;
  myMelds: Meld[];
  onExtend: (meldId: string) => void;
  onDiscard: () => void;
  mustPlaceCard: CardModel | null;
  desmocheMode: boolean;
  onToggleDesmoche: () => void;
  desmocheSource: DesmocheSource | null;
  onPickDestination: (meldId: string) => void;
}

export default function ActionBar({
  isYourTurn,
  canDraw,
  onDraw,
  canAct,
  selectedCount,
  onPlaceMeld,
  myMelds,
  onExtend,
  onDiscard,
  mustPlaceCard,
  desmocheMode,
  onToggleDesmoche,
  desmocheSource,
  onPickDestination,
}: ActionBarProps) {
  if (!isYourTurn) {
    return <p className="px-3 pb-2 text-center text-xs text-stone-400">Esperando el turno de otro jugador...</p>;
  }

  return (
    <div className="space-y-2 px-3 pb-3">
      {mustPlaceCard && (
        <p className="text-center text-xs text-gold">
          Debes usar la carta que tomaste del descarte en un grupo antes de descartar.
        </p>
      )}

      {canDraw && (
        <button
          onClick={onDraw}
          className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
        >
          Robar del mazo
        </button>
      )}

      {canAct && (
        <>
          <div className="flex gap-2">
            <button
              onClick={onPlaceMeld}
              disabled={selectedCount < 3}
              className="flex-1 rounded-lg border border-gold px-3 py-2 text-sm font-semibold text-gold disabled:opacity-40"
            >
              Bajar grupo nuevo
            </button>
            <button
              onClick={onDiscard}
              disabled={selectedCount !== 1 || Boolean(mustPlaceCard)}
              className="flex-1 rounded-lg border border-stone-500 px-3 py-2 text-sm text-stone-200 disabled:opacity-40"
            >
              Descartar
            </button>
          </div>

          {selectedCount > 0 && myMelds.length > 0 && !desmocheMode && (
            <div className="rounded-lg bg-stone-900/60 p-2">
              <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-stone-400">
                Agregar cartas seleccionadas a un grupo propio
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {myMelds.map((meld) => (
                  <button
                    key={meld.id}
                    onClick={() => onExtend(meld.id)}
                    className="rounded-md border border-stone-500 px-2 py-1 text-xs text-stone-200 hover:border-gold"
                  >
                    {meld.type === "run" ? "Escalera" : "Tercia"} ({meld.cards.length})
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onToggleDesmoche}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              desmocheMode ? "border-gold bg-gold/10 text-gold" : "border-stone-500 text-stone-200"
            }`}
          >
            {desmocheMode ? "Cancelar desmoche" : "Te toca desmochar"}
          </button>

          {desmocheMode && !desmocheSource && (
            <p className="text-center text-xs text-stone-400">
              Toca una carta de uno de tus grupos para tomarla.
            </p>
          )}

          {desmocheMode && desmocheSource && (
            <div className="rounded-lg bg-stone-900/60 p-2">
              <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-stone-400">
                Mueve la carta a otro de tus grupos
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {myMelds
                  .filter((meld) => meld.id !== desmocheSource.meldId)
                  .map((meld) => (
                    <button
                      key={meld.id}
                      onClick={() => onPickDestination(meld.id)}
                      className="rounded-md border border-green-500 px-2 py-1 text-xs text-green-300 hover:bg-green-900/30"
                    >
                      {meld.type === "run" ? "Escalera" : "Tercia"} ({meld.cards.length})
                    </button>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
