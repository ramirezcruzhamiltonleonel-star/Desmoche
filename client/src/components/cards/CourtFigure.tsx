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
      {/* Robe/shoulders — narrow at the collar, flaring wide at the hem, the
          way a draped royal robe actually falls (the previous shape flared
          the WRONG way, narrower at the base than the shoulders, which read
          more like a bowling pin/chess piece than a person). */}
      <path d="M 41 45 L 59 45 L 76 66 L 24 66 Z" opacity="0.88" />
      {/* Collar line, separating head from robe */}
      <path d="M 43 45 Q 50 49 57 45" fill="none" strokeWidth="1.3" opacity="0.9" />
      {/* Head */}
      <circle cx="50" cy="33" r="11.5" opacity="0.88" />
      {/* Headpiece */}
      {rank === "K" && (
        <path d="M 35 22 L 39 8 L 45 18 L 50 5 L 55 18 L 61 8 L 65 22 L 61 25 L 39 25 Z" />
      )}
      {rank === "Q" && (
        <path d="M 33 23 Q 37 11 43 19 Q 50 7 57 19 Q 63 11 67 23 Q 57 19 50 21 Q 43 19 33 23 Z" />
      )}
      {rank === "J" && <path d="M 35 24 L 65 24 L 62 15 L 38 15 Z" />}
      {/* Chest emblem — the suit itself, always legible regardless of color */}
      <text x="50" y="58" textAnchor="middle" fontSize="10.5" fill="currentColor" stroke="none">
        {SUIT_SYMBOL[suit]}
      </text>
      {/* Accessory — a second, quieter cue distinguishing the three ranks, kept
          clear of the headpiece so the two never overlap into visual noise. */}
      {rank === "K" && (
        <g>
          <line x1="65" y1="48" x2="79" y2="30" strokeWidth="1.8" />
          <circle cx="80" cy="27" r="2.6" fill="none" strokeWidth="1.4" />
        </g>
      )}
      {rank === "Q" && <path d="M 65 44 Q 80 34 76 18" fill="none" strokeWidth="1.8" />}
      {rank === "J" && (
        <g>
          <line x1="32" y1="46" x2="17" y2="15" strokeWidth="1.8" />
          <line x1="24" y1="24" x2="14" y2="19" strokeWidth="1.8" />
        </g>
      )}
    </g>
  );
}
