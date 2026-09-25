import type { ClientGameState } from "@desmoche/shared";
import { avatarForPlayerId, isBotPlayerId } from "./bot";
import type { GameState } from "./state";

export interface TableIdentity {
  code: string;
  stakeType: ClientGameState["stakeType"];
  ante: number;
  autoWinsEnabled: boolean;
  allowMeldsBeforeResolvingDraw: boolean;
}

/**
 * Projects the full (secret-holding) GameState down to what a single player
 * is allowed to see: their own hand in full, everyone else reduced to a card
 * count.
 */
export function toClientView(
  state: GameState,
  identity: TableIdentity,
  viewerPlayerId: string,
): ClientGameState {
  const viewerSeat = state.seats.find((s) => s.playerId === viewerPlayerId) ?? null;
  const topDiscard = state.discard.length > 0 ? state.discard[state.discard.length - 1]! : null;

  return {
    code: identity.code,
    stakeType: identity.stakeType,
    ante: identity.ante,
    autoWinsEnabled: identity.autoWinsEnabled,
    allowMeldsBeforeResolvingDraw: identity.allowMeldsBeforeResolvingDraw,
    phase: state.phase,
    seats: state.seats.map((seat) => ({
      seatIndex: seat.seatIndex,
      playerId: seat.playerId,
      displayName: seat.displayName,
      connected: seat.connected,
      ready: seat.ready,
      cardCount: state.hands[seat.playerId]?.length ?? 0,
      inactiveThisHand: state.inactiveSeatIndices.includes(seat.seatIndex),
      isBot: isBotPlayerId(seat.playerId),
      avatar: avatarForPlayerId(seat.playerId),
      chipsBalance: state.chipBalances[seat.playerId] ?? 0,
    })),
    yourSeatIndex: viewerSeat?.seatIndex ?? null,
    // Room.viewFor() overrides this with the real answer — it's the one that
    // knows who's spectating, a lobby/seating concept this pure projector
    // has no notion of.
    isSpectator: false,
    yourHand: state.hands[viewerPlayerId] ?? [],
    melds: state.melds,
    stockCount: state.stock.length,
    topDiscard,
    dealerSeatIndex: state.dealerSeatIndex,
    turnSeatIndex: state.turnSeatIndex,
    hasDrawnThisTurn: state.hasDrawnThisTurn,
    mustPlaceCard: state.mustPlaceCard,
    pendingDrawnCard:
      viewerSeat?.seatIndex === state.turnSeatIndex ? state.pendingDrawnCard : null,
    cambio: state.cambio
      ? {
          submittedSeatIndices: state.seats
            .filter((s) => state.cambio!.submitted[s.playerId])
            .map((s) => s.seatIndex),
        }
      : null,
    yourCambioSubmitted: Boolean(state.cambio && state.cambio.submitted[viewerPlayerId]),
    claim: state.claim
      ? {
          claimWindowId: state.claim.claimWindowId,
          card: state.claim.card,
          referenceSeatIndex: state.claim.referenceSeatIndex,
          pendingSeatIndices: state.claim.pendingSeatIndices,
          claimedBy: state.claim.claimedBy,
          fallbackSeatIndex: state.claim.fallbackSeatIndex,
          isInitialFlip: state.claim.isInitialFlip,
        }
      : null,
    accumulatedPot: state.accumulatedPot,
    handOutcome: state.handOutcome,
    eventLog: state.eventLog,
    yourReto: state.retos[viewerPlayerId] ?? null,
    // Populated by Room.viewFor(), which knows the table's stake config and
    // the running session history — this projector only has the rules-engine
    // state for the CURRENT hand, not settlements or cross-hand history.
    handSettlement: null,
    handHistory: [],
  };
}
