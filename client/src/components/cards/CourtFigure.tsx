import type { Card as CardModel } from "@desmoche/shared";

const SUIT_SYMBOL: Record<CardModel["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

interface CourtFigureProps {
  rank: "J" | "Q" | "K";
  suit: CardModel["suit"];
}

/**
 * One symmetric bust, drawn once and duplicated + rotated 180° to fill the
 * card top-to-bottom — same "double-headed" convention a real court card
 * uses. Deliberately simple, original geometric shapes (not a copy of any
 * licensed deck's artwork): a circle head, trapezoid shoulders, and a
 * rank-specific headpiece + accessory line (crown + scepter for King,
 * arched tiara + fan for Queen, banded cap + halberd for Jack) so the three
 * ranks stay visually distinct even reduced to silhouette, with the suit
 * glyph on the chest so the suit itself is never ambiguous.
 */
export default function CourtFigure({ rank, suit }: CourtFigureProps) {
  return (
    <svg viewBox="0 0 100 140" className="h-full w-full" role="img" aria-label={`Figura de ${rank}`}>
      <Bust rank={rank} suit={suit} />
      <g transform="rotate(180 50 70)">
        <Bust rank={rank} suit={suit} />
      </g>
    </svg>
  );
}

function Bust({ rank, suit }: CourtFigureProps) {
  return (
    <g fill="currentColor" stroke="currentColor">
      {/* Shoulders */}
      <path d="M 30 62 L 70 62 L 78 50 L 22 50 Z" opacity="0.85" />
      {/* Head */}
      <circle cx="50" cy="34" r="12" opacity="0.85" />
      {/* Headpiece */}
      {rank === "K" && <path d="M 36 22 L 40 9 L 46 19 L 50 6 L 54 19 L 60 9 L 64 22 Z" />}
      {rank === "Q" && (
        <g>
          <circle cx="38" cy="19" r="2.6" />
          <circle cx="50" cy="14" r="3" />
          <circle cx="62" cy="19" r="2.6" />
          <path d="M 36 23 Q 50 19 64 23" fill="none" strokeWidth="1.4" />
        </g>
      )}
      {rank === "J" && <path d="M 36 23 L 64 23 L 61 16 L 39 16 Z" />}
      {/* Chest emblem — the suit itself, always legible regardless of color */}
      <text x="50" y="53" textAnchor="middle" fontSize="11" fill="currentColor" stroke="none">
        {SUIT_SYMBOL[suit]}
      </text>
      {/* Accessory — a second, quieter cue distinguishing the three ranks, kept
          clear of the headpiece so the two never overlap into visual noise. */}
      {rank === "K" && (
        <g>
          <line x1="68" y1="46" x2="80" y2="28" strokeWidth="1.6" />
          <circle cx="81" cy="25" r="2.4" fill="none" strokeWidth="1.3" />
        </g>
      )}
      {rank === "Q" && <path d="M 68 42 Q 81 33 78 19" fill="none" strokeWidth="1.6" />}
      {rank === "J" && (
        <g>
          <line x1="30" y1="44" x2="18" y2="14" strokeWidth="1.6" />
          <line x1="22" y1="22" x2="14" y2="18" strokeWidth="1.6" />
        </g>
      )}
    </g>
  );
}
