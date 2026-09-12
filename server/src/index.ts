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
import { GameError } from "./game/errors";
import type { Table } from "./game/table";
import { createAuthRouter } from "./http/authRoutes";
import { persistHandOutcome } from "./persistence/handHistory";
import { Room } from "./rooms/room";
import { RoomManager } from "./rooms/roomManager";

const PORT = Number(process.env.PORT ?? 4000);
const CLAIM_WINDOW_MS = 12_000;

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

function errorMessage(err: unknown): string {
  return err instanceof GameError || err instanceof Error ? err.message : "Error desconocido";
}

function broadcastRoom(room: Room): void {
  for (const playerId of room.allPlayerIds()) {
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

function applyAction(table: Table, playerId: string, action: GameAction): void {
  switch (action.type) {
    case "draw-stock":
      table.drawFromStock(playerId);
      return;
    case "respond-claim":
      table.respondToClaim(playerId, action.response);
      return;
    case "choose-first-turn-card":
      table.chooseFirstTurnCard(playerId, action.card);
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
  }
}

io.on("connection", (socket: AppSocket) => {
  socket.on("table:create", ({ stakeType, ante }, ack: (r: JoinAck | ErrorPayload) => void) => {
    try {
      const room = roomManager.createRoom(stakeType, ante);
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

  socket.on("table:ready", ({ ready }) => {
    try {
      const { room, playerId } = currentRoomAndPlayer(socket);
      room.setReady(playerId, ready);
      broadcastRoom(room);
      scheduleClaimTimeoutIfNeeded(room);
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
    } catch (err) {
      socket.emit("table:error", { message: errorMessage(err) });
    }
  });

  socket.on("disconnect", () => {
    const { userId, code } = socket.data;
    if (!userId || !code) return;
    try {
      const room = roomManager.getRoom(code);
      room.setConnected(userId, false);
      if (socketIdByUserId.get(userId) === socket.id) {
        socketIdByUserId.delete(userId);
      }
      broadcastRoom(room);
    } catch {
      // Room no longer exists — nothing to clean up.
    }
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Desmoche server listening on :${PORT}`);
});
