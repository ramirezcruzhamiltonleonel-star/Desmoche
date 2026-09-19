import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ErrorPayload,
  GameAction,
  JoinAck,
  ServerToClientEvents,
} from "@desmoche/shared";
import { verifyAuthToken } from "./auth/jwt";
import { prisma } from "./db/prisma";
import { seedBotUsers } from "./db/seedBots";
import { fallbackBotAction, nextBotAction } from "./game/bot";
import { GameError } from "./game/errors";
import type { Table } from "./game/table";
import { createAuthRouter } from "./http/authRoutes";
import { createStatsRouter } from "./http/statsRoutes";
import { persistHandOutcome } from "./persistence/handHistory";
import { Room } from "./rooms/room";
import { RoomManager } from "./rooms/roomManager";

const PORT = Number(process.env.PORT ?? 4000);
/**
 * How long a claim window (the initial flip, every one-at-a-time ritual
 * reveal, and every normal mid-hand discard) stays open before treating
 * silence as a pass. Confirmed live in production that this is the ONLY
 * thing governing that window — bots claiming/passing quickly doesn't
 * shorten it for whoever's left pending, so this one number is the real
 * knob. 30s (up from 12s) so a human has real time to scan their whole hand
 * before it moves on, not just react to a flash.
 */
const CLAIM_WINDOW_MS = 30_000;
/** A bot's per-step pacing is randomized in this range instead of a fixed delay, so it reads as "thinking" rather than reacting instantly. */
const BOT_THINK_MS_MIN = 1_000;
const BOT_THINK_MS_MAX = 3_000;
function randomBotThinkMs(): number {
  return BOT_THINK_MS_MIN + Math.floor(Math.random() * (BOT_THINK_MS_MAX - BOT_THINK_MS_MIN + 1));
}
/** How long a disconnected seat stays in the current hand's rotation before being excluded — a page refresh or brief network drop shouldn't cost a mid-hand player their turn. */
const DISCONNECT_GRACE_MS = 60_000;

// CLIENT_ORIGIN: comma-separated allowed origins for the deployed frontend
// (e.g. "https://desmoche-client.up.railway.app"). Unset (dev default) allows
// any origin, since a wildcard is safe here — auth rides in the socket
// handshake payload, never a cookie, so there's no CSRF surface to widen.
const corsOrigin: string | string[] = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
  : "*";

interface SocketData {
  userId?: string;
  displayName?: string;
  code?: string;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", createAuthRouter(prisma));
app.use("/users", createStatsRouter(prisma));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: corsOrigin } },
);

// Every socket must carry a valid auth JWT — there is no anonymous play.
// "Reconnecting" is just `table:join`-ing again with the same account.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.["token"];
    if (typeof token !== "string" || !token) {
      throw new Error("Falta el token de autenticación");
    }
    const payload = verifyAuthToken(token);
    socket.data.userId = payload.userId;
    socket.data.displayName = payload.displayName;
    next();
  } catch {
    next(new Error("No autorizado"));
  }
});

const roomManager = new RoomManager();
const socketIdByUserId = new Map<string, string>();
// Voice chat is a pure signaling relay — the server never touches media, only
// tracks who's opted in per table so a newcomer can be told the existing
// roster (and existing members told about the newcomer) to drive the P2P
// mesh. Ephemeral, in-memory, keyed by table code.
const voiceParticipants = new Map<string, Set<string>>();

function errorMessage(err: unknown): string {
  return err instanceof GameError || err instanceof Error ? err.message : "Error desconocido";
}

function broadcastRoom(room: Room): void {
  for (const playerId of [...room.allPlayerIds(), ...room.allSpectatorIds()]) {
    const socketId = socketIdByUserId.get(playerId);
    if (!socketId) continue;
    io.sockets.sockets.get(socketId)?.emit("table:state", room.viewFor(playerId));
  }
}

/** Persists a finished hand's outcome exactly once (Room.maybeSettle guards repeats). */
function persistIfHandJustEnded(room: Room): void {
  const outcome = room.maybeSettle();
  if (!outcome) return;
  persistHandOutcome(prisma, room, outcome).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("No se pudo guardar el historial de la mano", err);
  });
}

/** If a discard just opened a claim window, force-resolve it (treating silence as a pass) after a grace period. */
function scheduleClaimTimeoutIfNeeded(room: Room): void {
  if (!room.hasStarted) return;
  const table = room.requireTable();
  if (table.state.phase !== "claim-window") return;

  setTimeout(() => {
    if (table.state.phase !== "claim-window") return;
    table.forceResolveClaimWindow();
    broadcastRoom(room);
    persistIfHandJustEnded(room);
    scheduleClaimTimeoutIfNeeded(room);
  }, CLAIM_WINDOW_MS);
}

/**
 * Drains any bot actions currently pending (Cambio, a claim-window response,
 * or an active turn) one step at a time, re-broadcasting after each so
 * clients see the bot "think" rather than the whole turn resolving at once.
 * Re-checks from scratch on every tick instead of trusting a stale plan, so
 * a human acting first (e.g. claiming before the bot gets to) simply makes
 * the next check find nothing to do.
 */
function driveBotsIfNeeded(room: Room): void {
  if (!room.hasStarted) return;
  const table = room.requireTable();
  if (!nextBotAction(table.state)) return;

  setTimeout(() => {
    if (!room.hasStarted) return;
    const pending = nextBotAction(table.state);
    if (!pending) return;

    try {
      applyAction(table, pending.playerId, pending.action);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Bot action rejected, falling back to a safe default", err);
      try {
        const fallback = fallbackBotAction(table.state, pending.playerId);
        if (fallback) applyAction(table, pending.playerId, fallback);
      } catch (fallbackErr) {
        // eslint-disable-next-line no-console
        console.error("Bot fallback action also failed — leaving it to a human/timeout", fallbackErr);
        broadcastRoom(room);
        return; // don't recurse — avoid a tight retry loop on a persistent bug
      }
    }

    broadcastRoom(room);
    persistIfHandJustEnded(room);
    scheduleClaimTimeoutIfNeeded(room);
    driveBotsIfNeeded(room);
  }, randomBotThinkMs());
}

function registerSocket(socket: AppSocket, room: Room): void {
  const userId = socket.data.userId!;
  socket.data.code = room.code;
  socketIdByUserId.set(userId, socket.id);
  void socket.join(room.code);
}

function currentRoomAndPlayer(socket: AppSocket): { room: Room; playerId: string } {
  const { userId, code } = socket.data;
  if (!userId || !code) throw new GameError("No estás conectado a ninguna mesa");
  return { room: roomManager.getRoom(code), playerId: userId };
}

/** Removes a player from a table's voice roster and tells whoever's left, so they can tear down that peer connection. */
function leaveVoice(code: string, playerId: string): void {
  const set = voiceParticipants.get(code);
  if (!set || !set.delete(playerId)) return;
  for (const peerId of set) {
    const socketId = socketIdByUserId.get(peerId);
    if (!socketId) continue;
    io.sockets.sockets.get(socketId)?.emit("voice:peer-left", { playerId });
  }
}

function applyAction(table: Table, playerId: string, action: GameAction): void {
  switch (action.type) {
    case "submit-cambio-card":
      table.submitCambioCard(playerId, action.card);
      return;
    case "draw-stock":
      table.drawFromStock(playerId);
      return;
    case "respond-claim":
      table.respondToClaim(playerId, action.response);
      return;
    case "place-meld":
      table.placeMeld(playerId, action.cards);
      return;
    case "extend-meld":
      table.extendMeld(playerId, action.meldId, action.cards);
      return;
    case "desmochar":
      table.desmochar(playerId, action.fromMeldId, action.toMeldId, action.card);
      return;
    case "discard":
      table.discard(playerId, action.card);
      return;
    case "retire-from-hand":
      table.retire(playerId);
      return;
  }
}

io.on("connection", (socket: AppSocket) => {
  socket.on("table:create", ({ stakeType, ante, autoWinsEnabled }, ack: (r: JoinAck | ErrorPayload) => void) => {
    try {
      const room = roomManager.createRoom(stakeType, ante, autoWinsEnabled ?? true);
      room.join(socket.data.userId!, socket.data.displayName!);
      registerSocket(socket, room);
      ack({ code: room.code });
      broadcastRoom(room);
    } catch (err) {
      ack({ message: errorMessage(err) });
    }
  });

  socket.on("table:join", ({ code }, ack: (r: JoinAck | ErrorPayload) => void) => {
    try {
      const room = roomManager.getRoom(code);
      room.join(socket.data.userId!, socket.data.displayName!);
      registerSocket(socket, room);
      ack({ code: room.code });
      broadcastRoom(room);
    } catch (err) {
      ack({ message: errorMessage(err) });
    }
  });

  socket.on("table:spectate", ({ code }, ack: (r: JoinAck | ErrorPayload) => void) => {
    try {
      const room = roomManager.getRoom(code);
      room.spectate(socket.data.userId!);
      registerSocket(socket, room);
      ack({ code: room.code });
      broadcastRoom(room);
    } catch (err) {
      ack({ message: errorMessage(err) });
    }
  });

  socket.on("table:ready", ({ ready }) => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      room.setReady(playerId, ready);
      broadcastRoom(room);
      scheduleClaimTimeoutIfNeeded(room);
      driveBotsIfNeeded(room);
    } catch (err) {
      socket.emit("table:error", { message: errorMessage(err) });
    }
  });

  socket.on("table:next-hand", () => {
    try {
      const { room } = currentRoomAndPlayer(socket);
      room.nextHand();
      broadcastRoom(room);
      scheduleClaimTimeoutIfNeeded(room);
      driveBotsIfNeeded(room);
    } catch (err) {
      socket.emit("table:error", { message: errorMessage(err) });
    }
  });

  socket.on("table:add-bot", () => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      room.addBot(playerId);
      broadcastRoom(room);
    } catch (err) {
      socket.emit("table:error", { message: errorMessage(err) });
    }
  });

  socket.on("table:remove-bot", ({ playerId: botPlayerId }) => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      room.removeBot(playerId, botPlayerId);
      broadcastRoom(room);
    } catch (err) {
      socket.emit("table:error", { message: errorMessage(err) });
    }
  });

  socket.on("game:action", (action) => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      const table = room.requireTable();
      applyAction(table, playerId, action);
      broadcastRoom(room);
      persistIfHandJustEnded(room);
      scheduleClaimTimeoutIfNeeded(room);
      driveBotsIfNeeded(room);
    } catch (err) {
      socket.emit("table:error", { message: errorMessage(err) });
    }
  });

  socket.on("voice:join", (ack) => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      const set = voiceParticipants.get(room.code) ?? new Set<string>();
      const existingPeers = [...set];
      set.add(playerId);
      voiceParticipants.set(room.code, set);
      ack({ peerIds: existingPeers });
      for (const peerId of existingPeers) {
        const socketId = socketIdByUserId.get(peerId);
        if (!socketId) continue;
        io.sockets.sockets.get(socketId)?.emit("voice:peer-joined", { playerId });
      }
    } catch {
      ack({ peerIds: [] });
    }
  });

  socket.on("voice:leave", () => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      leaveVoice(room.code, playerId);
    } catch {
      // Not at a table — nothing to leave.
    }
  });

  socket.on("voice:signal", ({ toPlayerId, data }) => {
    try {
      const { playerId } = currentRoomAndPlayer(socket);
      const socketId = socketIdByUserId.get(toPlayerId);
      if (!socketId) return;
      io.sockets.sockets.get(socketId)?.emit("voice:signal", { fromPlayerId: playerId, data });
    } catch {
      // Not at a table — drop the signal silently, it's not gameplay-critical.
    }
  });

  socket.on("disconnect", () => {
    const { userId, code } = socket.data;
    if (!userId || !code) return;
    try {
      const room = roomManager.getRoom(code);
      // A page refresh tears down the old socket AFTER the new one has
      // already connected and rejoined — if this stale disconnect were
      // applied unconditionally, it would wrongly flip a live player back
      // to "disconnected". Only act on it if no newer socket has replaced
      // this one for this user.
      if (socketIdByUserId.get(userId) !== socket.id) return;
      socketIdByUserId.delete(userId);
      room.setConnected(userId, false);
      leaveVoice(code, userId);
      broadcastRoom(room);
      // Give them a real chance to reconnect (a refresh, a brief network
      // drop) before it costs them their turn for the rest of this hand.
      setTimeout(() => {
        room.excludeFromCurrentHandIfStillDisconnected(userId);
        broadcastRoom(room);
        persistIfHandJustEnded(room);
        scheduleClaimTimeoutIfNeeded(room);
        driveBotsIfNeeded(room);
      }, DISCONNECT_GRACE_MS);
    } catch {
      // Room no longer exists — nothing to clean up.
    }
  });
});

seedBotUsers(prisma)
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("No se pudieron sembrar los usuarios bot", err);
  })
  .finally(() => {
    httpServer.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Desmoche server listening on :${PORT}`);
    });
  });
