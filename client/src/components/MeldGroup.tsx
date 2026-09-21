import type { Card as CardModel, Meld } from "@desmoche/shared";
import Card from "./Card";
import { cardKey } from "../lib/cardKey";
import { sortMeldCardsForDisplay } from "../lib/sortMeld";

interface MeldGroupProps {
  meld: Meld;
  size?: "xs" | "sm";
  pickable?: boolean;
  /** True when a pick is in progress elsewhere in this cluster and THIS meld isn't a legal option — dims it instead of leaving it looking just as inviting as the legal ones. */
  dimmed?: boolean;
  /** True for a brief moment right after this meld grew (placed, extended, or received a desmoche) — plays a one-shot success pulse. */
  justSucceeded?: boolean;
  onPickSourceCard?: (meldId: string, card: CardModel) => void;
  sourceCardKey?: string | null;
}

/** One meld (tercia or escalera), cards in reading order, in a tidy bordered strip. */
export default function MeldGroup({
  meld,
  size = "xs",
  pickable = false,
  dimmed = false,
  justSucceeded = false,
  onPickSourceCard,
  sourceCardKey,
}: MeldGroupProps) {
  return (
    <div
      data-meld-id={meld.id}
      className={`flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-md border-2 border-stone-600/40 bg-black/20 p-1 transition-opacity ${dimmed ? "opacity-40" : ""} ${justSucceeded ? "meld-success-pulse" : ""}`}
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
