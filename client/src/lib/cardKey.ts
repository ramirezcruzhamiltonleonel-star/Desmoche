import type { Card } from "@desmoche/shared";

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}
