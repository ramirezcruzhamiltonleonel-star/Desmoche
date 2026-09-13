import type { Card } from "./cards";
import type { StakeType } from "./melds";
import type { ClientGameState } from "./clientState";

export interface CreateTablePayload {
  stakeType: StakeType;
  ante: number;
}

export interface JoinTablePayload {
  code: string;
}

export interface JoinAck {
  code: string;
}

export type GameAction =
  | { type: "submit-cambio-card"; card: Card }
  | { type: "draw-stock" }
  | { type: "respond-claim"; response: "claim" | "pass" }
  | { type: "choose-first-turn-card"; card: Card }
  | { type: "place-meld"; cards: Card[] }
  | { type: "extend-meld"; meldId: string; cards: Card[] }
  | { type: "desmochar"; fromMeldId: string; toMeldId: string; card: Card }
  | { type: "discard"; card: Card };

export interface ErrorPayload {
  message: string;
}

/**
 * Client -> server event names and their payload/ack shapes. The socket
 * connection itself must carry a valid auth JWT (in the Socket.io `auth`
 * handshake field) — there is no anonymous session or reconnect token here;
 * "reconnecting" is just `table:join`-ing again with the same authenticated
 * user, which reactivates their existing seat.
 */
export interface ClientToServerEvents {
  "table:create": (payload: CreateTablePayload, ack: (result: JoinAck | ErrorPayload) => void) => void;
  "table:join": (payload: JoinTablePayload, ack: (result: JoinAck | ErrorPayload) => void) => void;
  "table:ready": (payload: { ready: boolean }) => void;
  "table:next-hand": () => void;
  "game:action": (action: GameAction) => void;
}

/** Server -> client event names. */
export interface ServerToClientEvents {
  "table:state": (state: ClientGameState) => void;
  "table:error": (error: ErrorPayload) => void;
}
