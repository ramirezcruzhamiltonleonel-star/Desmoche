import type { Card } from "./cards";
import type { StakeType } from "./melds";
import type { ClientGameState } from "./clientState";

export interface CreateTablePayload {
  stakeType: StakeType;
  ante: number;
  /** "Modo sin automáticas" opt-out — omit or true for the classic Peladía/Cuatro Cuerpos rules. */
  autoWinsEnabled?: boolean;
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
  | {
      type: "place-meld";
      cards: Card[];
      /**
       * Optional: one of `cards` is sourced from an existing own meld
       * (desmoche) rather than the hand — e.g. a stock-drawn card + a hand
       * card + a card pulled from an already-placed group, combined into a
       * brand-new group in one move. `card` must be one of `cards`, and
       * must actually be in the meld `fromMeldId` refers to.
       */
      desmoche?: { fromMeldId: string; card: Card };
    }
  | { type: "extend-meld"; meldId: string; cards: Card[] }
  | { type: "desmochar"; fromMeldId: string; toMeldId: string; card: Card }
  | { type: "discard"; card: Card }
  | { type: "retire-from-hand" };

export interface ErrorPayload {
  message: string;
}

/**
 * Voice chat signaling (P2P WebRTC mesh, up to 4 players per table). The
 * server only ever relays these — it never touches media, and these types
 * deliberately avoid the DOM lib's RTCSessionDescriptionInit/RTCIceCandidateInit
 * (the server package has no DOM lib) in favor of the same JSON-serializable
 * shape, which the client reconstructs into real WebRTC objects.
 */
export interface VoiceSdp {
  type: "offer" | "answer";
  sdp: string;
}

export interface VoiceIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type VoiceSignalData =
  | { kind: "sdp"; sdp: VoiceSdp }
  | { kind: "ice-candidate"; candidate: VoiceIceCandidate };

export interface VoicePeerEvent {
  playerId: string;
}

export interface VoiceSignalPayload {
  toPlayerId: string;
  data: VoiceSignalData;
}

export interface VoiceSignalReceived {
  fromPlayerId: string;
  data: VoiceSignalData;
}

export interface VoiceJoinAck {
  /** Everyone already in voice for this table when you joined — you wait for THEM to send offers, never initiate yourself, so two sides never race to send simultaneous offers. */
  peerIds: string[];
}

/**
 * The only reactions a player can ever send — a fixed allowlist, never free
 * text, so there's no moderation surface. The server rejects anything not
 * in this exact list (see index.ts's "reaction:send" handler), regardless
 * of what the client sends.
 */
export const REACTION_EMOJIS = ["👏", "😅", "🔥", "😂", "😮"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Type guard for REACTION_EMOJIS — the ONLY thing that decides whether a client-sent value is relayed at all, never trusting the client's own TS types (a hand-crafted socket message bypasses those entirely). */
export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

export interface ReactionSentEvent {
  playerId: string;
  emoji: ReactionEmoji;
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
  /** Watch a table already in progress without taking a seat — every hand stays hidden (card counts only) exactly like an opponent's does for a seated player, until it's melded onto the table. */
  "table:spectate": (payload: JoinTablePayload, ack: (result: JoinAck | ErrorPayload) => void) => void;
  "table:ready": (payload: { ready: boolean }) => void;
  /**
   * Explicit, permanent departure from the current table (not just this
   * hand — see "retire-from-hand" in GameAction for that). Stops every
   * future broadcast to this player for this room; see Room.leave() for
   * why a seat already dealt into a hand isn't removed outright.
   */
  "table:leave": () => void;
  "table:next-hand": () => void;
  "table:add-bot": () => void;
  "table:remove-bot": (payload: { playerId: string }) => void;
  "game:action": (action: GameAction) => void;
  "voice:join": (ack: (result: VoiceJoinAck) => void) => void;
  "voice:leave": () => void;
  "voice:signal": (payload: VoiceSignalPayload) => void;
  /** Only legal right after a hand ends ("hand-over" phase) — a quick, moderation-free reaction, not a chat message. Anything outside REACTION_EMOJIS is silently dropped server-side. */
  "reaction:send": (payload: { emoji: ReactionEmoji }) => void;
}

/** Server -> client event names. */
export interface ServerToClientEvents {
  "table:state": (state: ClientGameState) => void;
  "table:error": (error: ErrorPayload) => void;
  "voice:peer-joined": (event: VoicePeerEvent) => void;
  "voice:peer-left": (event: VoicePeerEvent) => void;
  "voice:signal": (event: VoiceSignalReceived) => void;
  "reaction:received": (event: ReactionSentEvent) => void;
}
