import { cardId, RANK_ORDER, type Card, type GameAction, type Meld } from "@desmoche/shared";
import { combinations } from "./combinations";
import { canDesmocharFrom, canUseDiscardImmediately } from "./meldActions";
import { canExtendMeld, isValidMeld } from "./melds";
import type { GameState } from "./state";
import { handOf } from "./state";

/**
 * Fixed bot personas. Every id is prefixed "bot:" — that prefix (see
 * `isBotPlayerId`) is the ONLY thing that distinguishes a bot seat from a
 * human one anywhere in the server; there's no separate "isBot" flag to keep
 * in sync. Also used as-is as the bots' `User.id` in Postgres (see
 * `db/seedBots.ts`) so hand history/chip balance need zero bot-specific
 * branching — they're just three more real Users.
 */
export const BOT_PERSONAS: { id: string; displayName: string }[] = [
  { id: "bot:fernando", displayName: "🤖 Fernando" },
  { id: "bot:carla", displayName: "🤖 Carla" },
  { id: "bot:mateo", displayName: "🤖 Mateo" },
];

export function isBotPlayerId(playerId: string): boolean {
  return playerId.startsWith("bot:");
}

/**
 * How useful a card is to the rest of the hand — same rank (toward a set) or
 * nearby same-suit cards (toward a run) both raise it. Not a full search,
 * just enough to make "give away"/"discard" choices non-random and
 * defensible: the least useful card by this score is never one that's
 * visibly one step from completing something.
 */
function cardUtility(card: Card, hand: Card[]): number {
  let score = 0;
  for (const other of hand) {
    if (cardId(other) === cardId(card)) continue;
    if (other.rank === card.rank) score += 2;
    if (other.suit === card.suit) {
      const dist = Math.abs(RANK_ORDER[other.rank] - RANK_ORDER[card.rank]);
      if (dist <= 2) score += 3 - dist;
    }
  }
  return score;
}

/** The card the bot is least likely to miss — used for both Cambio and discarding. */
export function leastUsefulCard(hand: Card[]): Card {
  let worst = hand[0]!;
  let worstScore = cardUtility(worst, hand);
  for (const card of hand.slice(1)) {
    const score = cardUtility(card, hand);
    if (score < worstScore) {
      worst = card;
      worstScore = score;
    }
  }
  return worst;
}

function ownMeldsOf(state: GameState, playerId: string): Meld[] {
  return state.melds.filter((m) => m.ownerId === playerId);
}

/** Whether `card` can extend one of these melds, and which one (first match). */
function findExtendableMeld(melds: Meld[], card: Card): Meld | null {
  return melds.find((m) => canExtendMeld(m.cards, card)) ?? null;
}

/**
 * A brand-new meld buildable from `pool` that includes `required` (if given)
 * — used both for "must place this specific drawn/claimed card" and for
 * "any complete meld sitting in hand" (required = null, pool = whole hand).
 */
function findNewMeld(pool: Card[], required: Card | null): Card[] | null {
  const rest = required ? pool.filter((c) => cardId(c) !== cardId(required)) : pool;
  for (const size of required ? [2, 3] : [3, 4]) {
    for (const combo of combinations(rest, size)) {
      const candidate = required ? [...combo, required] : combo;
      if (isValidMeld(candidate)) return candidate;
    }
  }
  return null;
}

/** Resolves a card that MUST be placed this turn (pendingDrawnCard or mustPlaceCard) — never returns null when eligibility was already verified at claim/draw time. */
function resolveRequiredCard(
  state: GameState,
  playerId: string,
  required: Card,
): GameAction {
  const ownMelds = ownMeldsOf(state, playerId);
  const extendable = findExtendableMeld(ownMelds, required);
  if (extendable) {
    return { type: "extend-meld", meldId: extendable.id, cards: [required] };
  }
  const hand = handOf(state, playerId);
  const newMeld = findNewMeld(hand, required);
  if (newMeld) {
    return { type: "place-meld", cards: newMeld };
  }
  // Only reachable for pendingDrawnCard (a fresh stock draw never checked for
  // usability up front, unlike a discard claim) — discard it back.
  return { type: "discard", card: required };
}

/**
 * One-ply desmoche lookahead: try moving a single card between two of the
 * bot's own table melds, and only take the move if it lets a hand card that
 * currently fits nowhere become placeable afterward. Never desmocha "just
 * because it can" — only when it visibly helps.
 */
function findBeneficialDesmoche(
  state: GameState,
  playerId: string,
): { fromMeldId: string; toMeldId: string; card: Card } | null {
  const ownMelds = ownMeldsOf(state, playerId);
  const hand = handOf(state, playerId);

  for (const from of ownMelds) {
    if (!canDesmocharFrom(from.cards)) continue;
    for (const card of from.cards) {
      for (const to of ownMelds) {
        if (to.id === from.id) continue;
        if (!canExtendMeld(to.cards, card)) continue;

        const shrunkFrom = from.cards.filter((c) => cardId(c) !== cardId(card));
        // canDesmocharFrom only checks length — pulling a middle card out of a
        // run can leave a non-consecutive remainder, so double-check validity
        // here rather than ever proposing a move that would corrupt the table.
        if (!isValidMeld(shrunkFrom)) continue;
        const helpsHandCard = hand.some((handCard) => {
          if (findExtendableMeld([{ ...from, cards: shrunkFrom }], handCard)) return true;
          if (findExtendableMeld([{ ...to, cards: [...to.cards, card] }], handCard)) return true;
          return false;
        });
        if (helpsHandCard) {
          return { fromMeldId: from.id, toMeldId: to.id, card };
        }
      }
    }
  }
  return null;
}

/** Full turn-active decision for a bot whose turn it currently is. */
export function decideTurnAction(state: GameState, playerId: string): GameAction {
  if (!state.hasDrawnThisTurn) {
    return { type: "draw-stock" };
  }
  if (state.pendingDrawnCard) {
    return resolveRequiredCard(state, playerId, state.pendingDrawnCard);
  }
  if (state.mustPlaceCard) {
    return resolveRequiredCard(state, playerId, state.mustPlaceCard);
  }

  const hand = handOf(state, playerId);
  const ownMelds = ownMeldsOf(state, playerId);

  for (const card of hand) {
    const extendable = findExtendableMeld(ownMelds, card);
    if (extendable) return { type: "extend-meld", meldId: extendable.id, cards: [card] };
  }
  const newMeld = findNewMeld(hand, null);
  if (newMeld) return { type: "place-meld", cards: newMeld };

  const desmoche = findBeneficialDesmoche(state, playerId);
  if (desmoche) return { type: "desmochar", ...desmoche };

  return { type: "discard", card: leastUsefulCard(hand) };
}

export function decideClaimResponse(
  state: GameState,
  playerId: string,
): "claim" | "pass" {
  if (!state.claim) return "pass";
  const hand = handOf(state, playerId);
  const ownMelds = ownMeldsOf(state, playerId);
  return canUseDiscardImmediately(hand, state.claim.card, ownMelds) ? "claim" : "pass";
}

/**
 * Given the CURRENT state, whether a bot needs to act right now and, if so,
 * exactly what action to take — one step at a time (a full bot turn is
 * several calls to this in a row, as the transport layer re-broadcasts and
 * re-checks after each one). Pure and side-effect-free: safe to call
 * speculatively without committing to anything.
 */
export function nextBotAction(state: GameState): { playerId: string; action: GameAction } | null {
  if (state.phase === "cambio" && state.cambio) {
    const cambio = state.cambio;
    const seat = state.seats.find(
      (s) =>
        isBotPlayerId(s.playerId) &&
        !state.inactiveSeatIndices.includes(s.seatIndex) &&
        !cambio.submitted[s.playerId],
    );
    if (!seat) return null;
    return {
      playerId: seat.playerId,
      action: { type: "submit-cambio-card", card: leastUsefulCard(handOf(state, seat.playerId)) },
    };
  }

  if (state.phase === "claim-window" && state.claim) {
    const claim = state.claim;
    const seatIndex = claim.pendingSeatIndices.find((idx) => {
      const seat = state.seats.find((s) => s.seatIndex === idx);
      return seat && isBotPlayerId(seat.playerId);
    });
    if (seatIndex === undefined) return null;
    const seat = state.seats.find((s) => s.seatIndex === seatIndex)!;
    return {
      playerId: seat.playerId,
      action: { type: "respond-claim", response: decideClaimResponse(state, seat.playerId) },
    };
  }

  if (state.phase === "turn-active") {
    const seat = state.seats.find((s) => s.seatIndex === state.turnSeatIndex);
    if (!seat || !isBotPlayerId(seat.playerId)) return null;
    return { playerId: seat.playerId, action: decideTurnAction(state, seat.playerId) };
  }

  return null;
}

/** Trivial, always-legal fallback per phase — used only if a bot's normal decision throws, to break a possible retry loop instead of stalling the table forever. */
export function fallbackBotAction(state: GameState, playerId: string): GameAction | null {
  if (state.phase === "cambio") {
    const hand = handOf(state, playerId);
    return hand[0] ? { type: "submit-cambio-card", card: hand[0] } : null;
  }
  if (state.phase === "claim-window") {
    return { type: "respond-claim", response: "pass" };
  }
  if (state.phase === "turn-active") {
    if (!state.hasDrawnThisTurn) return { type: "draw-stock" };
    const forced = state.pendingDrawnCard ?? state.mustPlaceCard;
    if (forced) return { type: "discard", card: forced };
    const hand = handOf(state, playerId);
    return hand[0] ? { type: "discard", card: hand[0] } : null;
  }
  return null;
}
