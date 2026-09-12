import type { Card as CardModel } from "@desmoche/shared";

const SUIT_SYMBOL: Record<CardModel["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RED_SUITS = new Set<CardModel["suit"]>(["hearts", "diamonds"]);

const SIZE_CLASSES = {
  sm: "h-14 w-10 text-xs",
  md: "h-20 w-14 text-base",
  lg: "h-24 w-16 text-lg",
} as const;

interface CardProps {
  card: CardModel;
  selected?: boolean;
  onClick?: () => void;
  size?: keyof typeof SIZE_CLASSES;
}

export default function Card({ card, selected = false, onClick, size = "md" }: CardProps) {
  const isRed = RED_SUITS.has(card.suit);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      disabled={!onClick}
      className={`flex shrink-0 flex-col items-center justify-between rounded-md border-2 bg-stone-50 px-1 py-1 font-semibold shadow-md transition
        ${isRed ? "text-red-600" : "text-stone-900"}
        ${selected ? "-translate-y-2 border-gold ring-2 ring-gold" : "border-stone-300"}
        ${onClick ? "cursor-pointer hover:-translate-y-1" : "cursor-default"}
        ${SIZE_CLASSES[size]}`}
    >
      <span className="self-start leading-none">{card.rank}</span>
      <span className="text-xl leading-none">{SUIT_SYMBOL[card.suit]}</span>
      <span className="self-end rotate-180 leading-none">{card.rank}</span>
    </button>
  );
}
