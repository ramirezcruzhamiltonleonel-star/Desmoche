import type { Card as CardModel } from "@desmoche/shared";
import CourtFigure from "./cards/CourtFigure";
import { PIP_LAYOUTS } from "./cards/pipLayout";

const SUIT_SYMBOL: Record<CardModel["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RED_SUITS = new Set<CardModel["suit"]>(["hearts", "diamonds"]);

const SIZE_CLASSES = {
  xs: "h-10 w-7 px-0.5 py-0.5 text-[8px]",
  sm: "h-14 w-10 px-1 py-1 text-[10px]",
  md: "h-20 w-14 px-1 py-1 text-xs",
  lg: "h-24 w-16 px-1 py-1 text-sm",
} as const;

// The index corner's own tiny suit glyph, beneath the rank — same
// proportion at every size, distinct from PIP_SYMBOL_SIZE (the face pips,
// which read bigger since there are fewer of them competing for space).
const CORNER_SUIT_SIZE = {
  xs: "text-[7px]",
  sm: "text-[9px]",
  md: "text-[11px]",
  lg: "text-xs",
} as const;

const PIP_SYMBOL_SIZE = {
  xs: "text-[7px]",
  sm: "text-[10px]",
  md: "text-sm",
  lg: "text-base",
} as const;

const ACE_SYMBOL_SIZE = {
  xs: "text-base",
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
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
  /** Claim-window only: this hand card would combine with the currently offered discard if claimed — a subtle gold cue, quieter than the offered card's own pulsing glow, so it's obvious at a glance whether claiming is even worth considering. Never overrides selected/pendingDraw/claimable/playable. */
  connectsToOffer?: boolean;
  onClick?: () => void;
  size?: keyof typeof SIZE_CLASSES;
}

function CardFace({ card, size }: { card: CardModel; size: keyof typeof SIZE_CLASSES }) {
  if (card.rank === "A") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex h-[62%] w-[62%] items-center justify-center rounded-full border border-current/25">
          <span className={`${ACE_SYMBOL_SIZE[size]} leading-none`}>{SUIT_SYMBOL[card.suit]}</span>
        </div>
      </div>
    );
  }

  if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
    return (
      <div className="absolute inset-x-1.5 inset-y-2.5">
        <CourtFigure rank={card.rank} suit={card.suit} />
      </div>
    );
  }

  const pips = PIP_LAYOUTS[Number(card.rank)] ?? [];
  return (
    <div className="absolute inset-0">
      {pips.map((pip, i) => (
        <span
          key={i}
          className={`absolute ${PIP_SYMBOL_SIZE[size]} leading-none`}
          style={{
            left: `${pip.x}%`,
            top: `${pip.y}%`,
            transform: `translate(-50%, -50%) ${pip.rotated ? "rotate(180deg)" : ""}`,
          }}
        >
          {SUIT_SYMBOL[card.suit]}
        </span>
      ))}
    </div>
  );
}

export default function Card({
  card,
  selected = false,
  pendingDraw = false,
  claimable = false,
  playable = false,
  connectsToOffer = false,
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
      className={`relative shrink-0 rounded-md border-2 bg-stone-50 font-card font-extrabold shadow-md transition
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
                  : connectsToOffer
                    ? "border-gold/70 shadow-[0_0_8px_-1px_rgba(212,175,55,0.65)]"
                    : "border-stone-300"
        }
        ${onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:scale-95" : "cursor-default"}
        ${SIZE_CLASSES[size]}`}
    >
      {/* Both corner indices are drawn the SAME way up, deliberately not the
          traditional 180°-rotated bottom index — rotating "6"/"9" or the
          two-character "10" as a block reads back as "9"/"6" or "01" (a
          reported legibility bug), and nothing in this digital table is
          ever viewed from the "other end" the way a real fanned-out card
          would be, so the rotation bought us a confusion with no upside. */}
      <span className="absolute left-1 top-0.5 flex flex-col items-center leading-none">
        <span className="tabular-nums">{card.rank}</span>
        <span className={CORNER_SUIT_SIZE[size]}>{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="absolute right-1 bottom-0.5 flex flex-col items-center leading-none">
        <span className="tabular-nums">{card.rank}</span>
        <span className={CORNER_SUIT_SIZE[size]}>{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <CardFace card={card} size={size} />
    </button>
  );
}
