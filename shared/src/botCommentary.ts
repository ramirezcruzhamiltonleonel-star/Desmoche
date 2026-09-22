import type { Card } from "./cards";
import { meldLabel } from "./meldLabel";
import type { Meld, MeldType } from "./melds";

const RANK_WORD_OVERRIDE: Partial<Record<Card["rank"], string>> = {
  A: "ases",
  J: "jotas",
  Q: "reinas",
  K: "reyes",
};

/** "tercia de jotas" / "escalera ♥ 5-7" — a natural phrase for a bot speech bubble, not the compact "(3)"-suffixed UI label. */
export function formatMeldCommentary(meldType: MeldType, cards: Card[]): string {
  const base = meldLabel({ id: "", ownerId: "", type: meldType, cards } as Meld).replace(/\s*\(\d+\)$/, "");
  if (meldType === "set") {
    const override = RANK_WORD_OVERRIDE[cards[0]?.rank as Card["rank"]];
    if (override) return `tercia de ${override}`;
  }
  return base.toLowerCase();
}
