import type { Card as CardModel, Meld } from "@desmoche/shared";
import Card from "./Card";
import { cardKey } from "../lib/cardKey";

interface MeldsBoardProps {
  melds: Meld[];
  seatNameByPlayerId: Record<string, string>;
  canPickSourceFrom?: (meld: Meld) => boolean;
  onPickSourceCard?: (meldId: string, card: CardModel) => void;
  sourceCardKey?: string | null;
}

export default function MeldsBoard({
  melds,
  seatNameByPlayerId,
  canPickSourceFrom,
  onPickSourceCard,
  sourceCardKey,
}: MeldsBoardProps) {
  if (melds.length === 0) {
    return <p className="text-center text-xs text-stone-400/70">Todavía no hay grupos bajados</p>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {melds.map((meld) => {
        const pickable = canPickSourceFrom?.(meld) ?? false;
        return (
          <div
            key={meld.id}
            data-meld-id={meld.id}
            className="flex flex-col items-center gap-1 rounded-lg border-2 border-stone-600/40 bg-black/10 p-2"
          >
            <span className="text-[10px] uppercase tracking-wide text-stone-400">
              {seatNameByPlayerId[meld.ownerId] ?? "?"}
            </span>
            <div className="flex gap-1">
              {meld.cards.map((card) => (
                <div key={cardKey(card)} data-card-key={cardKey(card)}>
                  <Card
                    card={card}
                    size="sm"
                    selected={sourceCardKey === cardKey(card)}
                    onClick={pickable ? () => onPickSourceCard?.(meld.id, card) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
