import type { Card as CardModel, Meld } from "@desmoche/shared";

interface DesmocheSource {
  meldId: string;
  card: CardModel;
}

interface ActionBarProps {
  isYourTurn: boolean;
  /** Cambio/claim-window/hand-over all have their own overlay UI — this bar has nothing useful to add there. */
  isTurnActivePhase: boolean;
  canDraw: boolean;
  onDraw: () => void;
  canAct: boolean;
  selectedCount: number;
  /** Whether the currently selected cards actually form a valid meld — same rule the server enforces, so this button is never clickable only to get rejected. */
  canPlaceMeld: boolean;
  onPlaceMeld: () => void;
  myMelds: Meld[];
  /** Which of myMelds the current selection would validly extend. */
  extendableMeldIds: Set<string>;
  onExtend: (meldId: string) => void;
  /** Whether the current selection is a legal thing to discard right now (exactly 1 card, and — when a stock draw or claimed discard is pending — exactly that card). */
  canDiscardSelection: boolean;
  onDiscard: () => void;
  mustPlaceCard: CardModel | null;
  pendingDrawnCard: CardModel | null;
  /** Whether at least one own meld has a spare card to shed — desmoche is pointless to offer otherwise. */
  canDesmoche: boolean;
  desmocheMode: boolean;
  onToggleDesmoche: () => void;
  desmocheSource: DesmocheSource | null;
  /** Which of myMelds (other than the source) the picked-up card would validly land in. */
  validDesmocheDestinationIds: Set<string>;
  onPickDestination: (meldId: string) => void;
  /** Whether the picked-up desmoche card, combined with the current hand selection, forms a valid brand-new meld. */
  canPlaceMeldWithDesmoche: boolean;
  onPlaceMeldWithDesmoche: () => void;
}

export default function ActionBar({
  isYourTurn,
  isTurnActivePhase,
  canDraw,
  onDraw,
  canAct,
  selectedCount,
  canPlaceMeld,
  onPlaceMeld,
  myMelds,
  extendableMeldIds,
  onExtend,
  canDiscardSelection,
  onDiscard,
  mustPlaceCard,
  pendingDrawnCard,
  canDesmoche,
  desmocheMode,
  onToggleDesmoche,
  desmocheSource,
  validDesmocheDestinationIds,
  onPickDestination,
  canPlaceMeldWithDesmoche,
  onPlaceMeldWithDesmoche,
}: ActionBarProps) {
  if (!isTurnActivePhase) {
    // Cambio, the claim window, the first-turn choice, and the hand-over
    // summary all show their own overlay — nothing useful to add here.
    return null;
  }
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

      {pendingDrawnCard && (
        <p className="text-center text-xs text-gold">
          Robaste esta carta del mazo — úsala en un grupo (podés combinarla con una carta
          desmochada de uno de tus grupos para armar uno nuevo) o descártala ahora mismo. No
          puedes descartar ninguna otra en su lugar.
        </p>
      )}

      {canDraw && (
        <button
          onClick={onDraw}
          className="pending-draw-glow w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 shadow-lg ring-2 ring-gold transition hover:bg-gold-light"
        >
          Robar del mazo
        </button>
      )}

      {canAct && (
        <>
          <div className="flex gap-2">
            <button
              onClick={onPlaceMeld}
              disabled={!canPlaceMeld}
              title={selectedCount >= 3 && !canPlaceMeld ? "Esas cartas no forman un grupo válido" : undefined}
              className="flex-1 rounded-lg border border-gold px-3 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Bajar grupo nuevo
            </button>
            <button
              onClick={onDiscard}
              disabled={!canDiscardSelection}
              className="flex-1 rounded-lg border border-stone-500 px-3 py-2 text-sm text-stone-200 disabled:cursor-not-allowed disabled:opacity-40"
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
                {myMelds.map((meld) => {
                  const legal = extendableMeldIds.has(meld.id);
                  return (
                    <button
                      key={meld.id}
                      onClick={() => onExtend(meld.id)}
                      disabled={!legal}
                      title={legal ? undefined : "Esa carta no encaja en este grupo"}
                      className="rounded-md border border-stone-500 px-2 py-1 text-xs text-stone-200 hover:border-gold disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-stone-500"
                    >
                      {meld.type === "run" ? "Escalera" : "Tercia"} ({meld.cards.length})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {myMelds.length > 0 ? (
            <button
              onClick={onToggleDesmoche}
              disabled={!desmocheMode && !canDesmoche}
              title={canDesmoche ? undefined : "Ninguno de tus grupos tiene una carta de sobra para mover"}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                desmocheMode ? "border-gold bg-gold/10 text-gold" : "border-stone-500 text-stone-200"
              }`}
            >
              {desmocheMode ? "Cancelar desmoche" : "Te toca desmochar"}
            </button>
          ) : (
            <p className="text-center text-xs text-stone-500">
              Necesitas al menos 1 grupo propio en la mesa para desmochar.
            </p>
          )}

          {desmocheMode && !desmocheSource && (
            <p className="text-center text-xs text-stone-400">
              Toca una carta resaltada de uno de tus grupos para tomarla.
            </p>
          )}

          {desmocheMode && desmocheSource && (
            <div className="space-y-2">
              {/* Moving into an EXISTING group doesn't touch the pending
                  drawn/claimed card, so it's only offered once that's already
                  resolved — otherwise the button would be a dead end. */}
              {!pendingDrawnCard && myMelds.length > 1 && (
                <div className="rounded-lg bg-stone-900/60 p-2">
                  <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-stone-400">
                    Mueve la carta a otro de tus grupos
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {myMelds
                      .filter((meld) => meld.id !== desmocheSource.meldId)
                      .map((meld) => {
                        const legal = validDesmocheDestinationIds.has(meld.id);
                        return (
                          <button
                            key={meld.id}
                            onClick={() => onPickDestination(meld.id)}
                            disabled={!legal}
                            title={legal ? undefined : "Esa carta no encaja en este grupo"}
                            className="rounded-md border border-green-500 px-2 py-1 text-xs text-green-300 hover:bg-green-900/30 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            {meld.type === "run" ? "Escalera" : "Tercia"} ({meld.cards.length})
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-stone-900/60 p-2">
                <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-stone-400">
                  O combinala con cartas de tu mano en un grupo nuevo
                </p>
                <button
                  onClick={onPlaceMeldWithDesmoche}
                  disabled={!canPlaceMeldWithDesmoche}
                  title={
                    canPlaceMeldWithDesmoche
                      ? undefined
                      : "Selecciona en tu mano las cartas que, junto con esta, formen un grupo válido"
                  }
                  className="w-full rounded-lg border border-gold px-3 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Bajar grupo nuevo con esta carta
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
