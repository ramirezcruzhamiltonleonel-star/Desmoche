import type { Card as CardModel } from "@desmoche/shared";

const SUIT_SYMBOL: Record<CardModel["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RED_SUITS = new Set<CardModel["suit"]>(["hearts", "diamonds"]);

const SIZE_CLASSES = {
  xs: "h-10 w-7 px-0.5 py-0.5 text-[9px]",
  sm: "h-14 w-10 px-1 py-1 text-xs",
  md: "h-20 w-14 px-1 py-1 text-base",
  lg: "h-24 w-16 px-1 py-1 text-lg",
} as const;

// The suit glyph is deliberately bigger than the rank text at every size —
// scaled here to match, since the rest of the card's font size comes from
// SIZE_CLASSES above.
const SUIT_SYMBOL_SIZE = {
  xs: "text-xs",
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
} as const;

interface CardProps {
  card: CardModel;
  selected?: boolean;
  /** The card just drawn from the stock this turn, still pending a decision (meld or discard) — bigger and gold-lit so it's unmistakable among the other 9. Only ever true in the drawing player's own hand. */
  pendingDraw?: boolean;
  /** The top-of-discard card while a claim window is open — same gold glow as pendingDraw, but shown to EVERY player/spectator (not just whoever drew it), so nobody misses their chance to claim it. */
  claimable?: boolean;
  /** This hand card, on its own or combined with others, is part of at least one legal move right now (extends an own meld, or forms a new one) — a quiet green cue so real options stand out instead of the whole hand looking equally clickable. Never overrides selected/pendingDraw/claimable, which are all more urgent states. */
  playable?: boolean;
  onClick?: () => void;
  size?: keyof typeof SIZE_CLASSES;
}

export default function Card({
  card,
  selected = false,
  pendingDraw = false,
  claimable = false,
  playable = false,
  onClick,
  size = "md",
}: CardProps) {
  const isRed = RED_SUITS.has(card.suit);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      disabled={!onClick}
      className={`flex shrink-0 flex-col items-center justify-between rounded-md border-2 bg-stone-50 font-card font-extrabold shadow-md transition
        ${isRed ? "text-red-700" : "text-stone-900"}
        ${
          pendingDraw
            ? "pending-draw-glow z-10 scale-110 -translate-y-2 border-gold ring-4 ring-gold"
            : claimable
              ? "pending-draw-glow z-10 border-gold ring-4 ring-gold"
              : selected
                ? "-translate-y-2 border-gold ring-2 ring-gold"
                : playable
                  ? "border-green-500 ring-2 ring-green-500/70"
                  : "border-stone-300"
        }
        ${onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:scale-95" : "cursor-default"}
        ${SIZE_CLASSES[size]}`}
    >
      {/* Both indices are drawn the SAME way up, deliberately not the
          traditional 180°-rotated bottom index — rotating "6"/"9" or the
          two-character "10" as a block reads back as "9"/"6" or "01" (a
          reported legibility bug), and nothing in this digital table is
          ever viewed from the "other end" the way a real fanned-out card
          would be, so the rotation bought us a confusion with no upside. */}
      <span className="self-start tabular-nums leading-none">{card.rank}</span>
      <span className={`${SUIT_SYMBOL_SIZE[size]} leading-none`}>{SUIT_SYMBOL[card.suit]}</span>
      <span className="self-end tabular-nums leading-none">{card.rank}</span>
    </button>
  );
}
