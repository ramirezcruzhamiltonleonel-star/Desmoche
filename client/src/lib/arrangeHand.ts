import type { Card } from "@desmoche/shared";
import { cardKey } from "./cardKey";
import { sortHandForDisplay } from "./sortHand";
import { LOW_ACE_VALUE, sortSetForDisplay } from "./sortMeld";

const RUN_CLUSTER_MAX_GAP = 2; // same-suit cards up to 2 apart could still be bridged by a single missing card

/**
 * Purely visual "Acomodar" reorder: groups cards that already share a
 * potential meld together (same rank — a possible tercia; same suit and
 * close in rank — a possible escalera), each group internally ordered the
 * same way a real meld would be, then any leftover cards with no partner
 * yet, in the app's normal suit/rank order. Never validates, never suggests
 * a SPECIFIC play, never changes the actual hand — only how these same 9 (or
 * 10) cards are laid out for THIS player to scan at a glance.
 */
export function arrangeHandForDisplay(hand: Card[]): Card[] {
  const claimed = new Set<string>();
  const groups: Card[][] = [];

  // 1) Same-rank groups (potential tercias/pokers) — claimed first since a
  // rank match is unambiguous, unlike a same-suit proximity guess.
  const byRank = new Map<Card["rank"], Card[]>();
  for (const card of hand) {
    const list = byRank.get(card.rank) ?? [];
    list.push(card);
    byRank.set(card.rank, list);
  }
  for (const cards of byRank.values()) {
    if (cards.length < 2) continue;
    groups.push(sortSetForDisplay(cards));
    for (const card of cards) claimed.add(cardKey(card));
  }

  // 2) Among whatever's left, same-suit clusters close enough in rank to be
  // bridged by one missing card (potential escaleras).
  const remaining = hand.filter((card) => !claimed.has(cardKey(card)));
  const bySuit = new Map<Card["suit"], Card[]>();
  for (const card of remaining) {
    const list = bySuit.get(card.suit) ?? [];
    list.push(card);
    bySuit.set(card.suit, list);
  }
  for (const cards of bySuit.values()) {
    const sorted = [...cards].sort((a, b) => LOW_ACE_VALUE[a.rank] - LOW_ACE_VALUE[b.rank]);
    let cluster: Card[] = [];
    const flush = () => {
      if (cluster.length >= 2) {
        groups.push(cluster);
        for (const card of cluster) claimed.add(cardKey(card));
      }
      cluster = [];
    };
    for (const card of sorted) {
      const prev = cluster[cluster.length - 1];
      if (prev && LOW_ACE_VALUE[card.rank] - LOW_ACE_VALUE[prev.rank] > RUN_CLUSTER_MAX_GAP) {
        flush();
      }
      cluster.push(card);
    }
    flush();
  }

  // Larger (closer-to-complete) groups first; ties keep insertion order.
  groups.sort((a, b) => b.length - a.length);

  const loose = sortHandForDisplay(hand.filter((card) => !claimed.has(cardKey(card))));
  return [...groups.flat(), ...loose];
}
