import { combinations } from "./combinations";
import type { Card } from "./cards";
import { canExtendMeld, isValidMeld, isValidSet } from "./meldRules";
import { meldLabel } from "./meldLabel";
import type { Meld } from "./melds";

const SUIT_SYMBOL: Record<Card["suit"], string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

/**
 * Explains WHY a claimable discard genuinely serves this player right now —
 * for the one-time first-claim hint (client decides whether to actually
 * show it; this only ever needs to answer "why", assuming the caller
 * already knows canUseDiscardImmediately is true for this exact card/hand/
 * ownMelds combination). Returns null only if that assumption doesn't hold
 * (nothing found) — the caller should treat that as "don't show a hint".
 */
export function explainClaimUsefulness(hand: Card[], card: Card, ownMelds: Meld[]): string | null {
  const directMeld = ownMelds.find((m) => canExtendMeld(m.cards, card));
  if (directMeld) {
    const label = meldLabel(directMeld).replace(/\s*\(\d+\)$/, "").toLowerCase();
    return `El ${cardLabel(card)} se suma a tu ${label} en mesa. Tocá "Sí me sirve".`;
  }

  for (const size of [2, 3]) {
    for (const combo of combinations(hand, size)) {
      const candidate = [...combo, card];
      if (!isValidMeld(candidate)) continue;
      if (isValidSet(candidate)) {
        return `El ${cardLabel(card)} te arma tercia con tus otros ${card.rank} de la mano. Tocá "Sí me sirve".`;
      }
      return `El ${cardLabel(card)} completa una escalera con cartas de tu mano. Tocá "Sí me sirve".`;
    }
  }

  return null;
}
