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
  | { type: "place-meld"; cards: Card[] }
  | { type: "extend-meld"; meldId: string; cards: Card[] }
  | { type: "desmochar"; fromMeldId: string; toMeldId: string; card: Card }
  | { type: "discard"; card: Card };

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
  "voice:join": (ack: (result: VoiceJoinAck) => void) => void;
  "voice:leave": () => void;
  "voice:signal": (payload: VoiceSignalPayload) => void;
}

/** Server -> client event names. */
export interface ServerToClientEvents {
  "table:state": (state: ClientGameState) => void;
  "table:error": (error: ErrorPayload) => void;
  "voice:peer-joined": (event: VoicePeerEvent) => void;
  "voice:peer-left": (event: VoicePeerEvent) => void;
  "voice:signal": (event: VoiceSignalReceived) => void;
}
