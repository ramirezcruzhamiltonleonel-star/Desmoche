import type { Card as CardModel, Meld } from "@desmoche/shared";
import Card from "./Card";
import { cardKey } from "../lib/cardKey";
import { sortMeldCardsForDisplay } from "../lib/sortMeld";

interface MeldGroupProps {
  meld: Meld;
  size?: "xs" | "sm";
  pickable?: boolean;
  onPickSourceCard?: (meldId: string, card: CardModel) => void;
  sourceCardKey?: string | null;
}

/** One meld (tercia or escalera), cards in reading order, in a tidy bordered strip. */
export default function MeldGroup({ meld, size = "xs", pickable = false, onPickSourceCard, sourceCardKey }: MeldGroupProps) {
  return (
    <div
      data-meld-id={meld.id}
      className="flex shrink-0 gap-0.5 overflow-x-auto rounded-md border-2 border-stone-600/40 bg-black/20 p-1"
    >
      {sortMeldCardsForDisplay(meld).map((card) => (
        <div key={cardKey(card)} data-card-key={cardKey(card)}>
          <Card
            card={card}
            size={size}
            selected={sourceCardKey === cardKey(card)}
            onClick={pickable ? () => onPickSourceCard?.(meld.id, card) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
