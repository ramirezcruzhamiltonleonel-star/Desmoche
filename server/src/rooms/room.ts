import type { ClientGameState, ClientHandHistoryEntry, StakeType } from "@desmoche/shared";
import { toClientView } from "../game/clientView";
import { GameError } from "../game/errors";
import { Table } from "../game/table";
import type { HandOutcome } from "../game/payouts";
import type { Seat, TableConfig } from "../game/state";
import { nextSeat } from "../game/turnOrder";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skips 0/O/1/I to avoid confusion

export function generateTableCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Owns one table's lobby (players joining/readying up by code) and, once
 * everyone is ready, the live `Table` for the hand in progress. Knows
 * nothing about Socket.io — the transport layer drives it through this API
 * and broadcasts `viewFor(playerId)` to whoever needs an update.
 *
 * `playerId` is always the authenticated user's persistent id (from the JWT),
 * never a per-session token — reconnecting is just joining again with the
 * same id, which reactivates the existing seat instead of adding a new one.
 */
export class Room {
  readonly code: string;
  readonly stakeType: StakeType;
  readonly ante: number;

  private seats: Seat[] = [];
  private table: Table | null = null;
  private dealerSeatIndex = 0;
  private handSettled = false;
  private settlementCache: HandOutcome | null = null;
  /** Every hand settled so far this session — never reset across hands, only starts empty for a brand-new Room. */
  private history: ClientHandHistoryEntry[] = [];

  constructor(code: string, stakeType: StakeType, ante: number) {
    this.code = code;
    this.stakeType = stakeType;
    this.ante = ante;
  }

  get hasStarted(): boolean {
    return this.table !== null;
  }

  get playerCount(): number {
    return this.seats.length;
  }

  /** Joins a brand-new seat, or reactivates the caller's existing one if they were already seated. */
  join(userId: string, displayName: string): void {
    const existing = this.seats.find((s) => s.playerId === userId);
    if (existing) {
      this.setConnected(userId, true);
      return;
    }

    if (this.hasStarted) throw new GameError("La mesa ya empezó a jugar");
    if (this.seats.length >= 4) throw new GameError("La mesa ya está llena");

    this.seats.push({
      seatIndex: this.seats.length,
      playerId: userId,
      displayName,
      connected: true,
      ready: false,
    });
  }

  setConnected(playerId: string, connected: boolean): void {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (seat) seat.connected = connected;
    const tableSeat = this.table?.state.seats.find((s) => s.playerId === playerId);
    if (tableSeat) tableSeat.connected = connected;
  }

  setReady(playerId: string, ready: boolean): void {
    if (this.hasStarted) return;
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) throw new GameError("Jugador no está en esta mesa");
    seat.ready = ready;

    if (ready && this.seats.length >= 2 && this.seats.every((s) => s.ready)) {
      this.startGame();
    }
  }

  private startGame(): void {
    const config: TableConfig = { code: this.code, stakeType: this.stakeType, ante: this.ante };
    this.dealerSeatIndex = 0;
    this.handSettled = false;
    this.settlementCache = null;
    this.table = new Table(
      config,
      this.seats.map((s) => ({ ...s })),
    );
    this.table.startHand(this.dealerSeatIndex);
  }

  nextHand(): void {
    const table = this.requireTable();
    if (table.state.phase !== "hand-over") {
      throw new GameError("La mano en curso todavía no terminó");
    }
    this.dealerSeatIndex = nextSeat(this.dealerSeatIndex, this.seats.length);
    this.handSettled = false;
    this.settlementCache = null;
    table.startHand(this.dealerSeatIndex);
  }

  requireTable(): Table {
    if (!this.table) throw new GameError("La mesa todavía no ha empezado a jugar");
    return this.table;
  }

  /** Computes and caches the settlement as soon as a hand ends, so every view can show it — idempotent. */
  private ensureSettlementComputed(): void {
    if (this.settlementCache || !this.table || this.table.state.phase !== "hand-over") return;
    this.settlementCache = this.table.settleHand();
    const outcome = this.table.state.handOutcome;
    if (outcome) {
      this.history.push({
        reason: outcome.reason,
        winnerSeatIndex: outcome.winnerSeatIndex,
        settlement: this.settlementCache,
        playedAt: Date.now(),
      });
    }
  }

  /**
   * Returns the settlement the FIRST time it's called after a hand ends, and
   * null on every later call for that same hand — lets the transport layer
   * persist each hand's outcome exactly once without tracking its own flags.
   */
  maybeSettle(): HandOutcome | null {
    this.ensureSettlementComputed();
    if (!this.settlementCache || this.handSettled) return null;
    this.handSettled = true;
    return this.settlementCache;
  }

  allPlayerIds(): string[] {
    return this.seats.map((s) => s.playerId);
  }

  viewFor(playerId: string): ClientGameState {
    this.ensureSettlementComputed();

    if (this.table) {
      return {
        ...toClientView(
          this.table.state,
          { code: this.code, stakeType: this.stakeType, ante: this.ante },
          playerId,
        ),
        handSettlement: this.settlementCache,
        handHistory: this.history,
      };
    }

    return {
      code: this.code,
      stakeType: this.stakeType,
      ante: this.ante,
      phase: "lobby",
      seats: this.seats.map((s) => ({
        seatIndex: s.seatIndex,
        playerId: s.playerId,
        displayName: s.displayName,
        connected: s.connected,
        ready: s.ready,
        cardCount: 0,
      })),
      yourSeatIndex: this.seats.find((s) => s.playerId === playerId)?.seatIndex ?? null,
      yourHand: [],
      melds: [],
      stockCount: 0,
      topDiscard: null,
      dealerSeatIndex: 0,
      // No turn exists yet — phase is 'lobby', clients must gate on that
      // rather than treat this as a real seat index.
      turnSeatIndex: -1,
      hasDrawnThisTurn: false,
      mustPlaceCard: null,
      pendingDrawnCard: null,
      cambio: null,
      yourCambioSubmitted: false,
      claim: null,
      accumulatedPot: 0,
      handOutcome: null,
      handSettlement: null,
      handHistory: this.history,
    };
  }
}
