import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClientGameState, GameAction, StakeType } from "@desmoche/shared";
import { connectSocket, disconnectSocket, type AppSocket } from "../lib/socket";
import { clearTableCode, loadTableCode, loadTableMode, saveTableCode } from "../lib/tableStorage";
import { useAuth } from "./AuthContext";

interface GameContextValue {
  connected: boolean;
  /** The live socket, for features (voice chat signaling) that need to emit/listen for events GameContext doesn't otherwise model. Null until connected. */
  socket: AppSocket | null;
  state: ClientGameState | null;
  lastError: string | null;
  dismissError: () => void;
  createTable: (stakeType: StakeType, ante: number, autoWinsEnabled: boolean) => Promise<void>;
  joinTable: (code: string) => Promise<void>;
  spectateTable: (code: string) => Promise<void>;
  /** "Jugar ahora": creates a private table, fills it with 3 bots, and marks the caller ready — a full hand is dealt with no lobby/setup step at all. */
  startInstantDemo: () => Promise<void>;
  leaveTable: () => void;
  setReady: (ready: boolean) => void;
  nextHand: () => void;
  sendAction: (action: GameAction) => void;
  addBot: () => void;
  removeBot: (playerId: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { token, isGuest } = useAuth();
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [state, setState] = useState<ClientGameState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      setConnected(false);
      setSocket(null);
      setState(null);
      return;
    }

    const socket = connectSocket(token);
    socketRef.current = socket;
    setSocket(socket);

    socket.on("connect", () => {
      setConnected(true);
      const savedCode = loadTableCode(isGuest);
      if (savedCode) {
        const event = loadTableMode(isGuest) === "spectator" ? "table:spectate" : "table:join";
        socket.emit(event, { code: savedCode }, (result) => {
          if ("message" in result) clearTableCode(isGuest);
        });
      }
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("table:state", (nextState) => {
      setState(nextState);
      // A guest's table code is saved too now (to sessionStorage — this tab
      // only, gone on close — see guestSessionStorage.ts), so a refresh
      // while waiting in the lobby or mid-hand can rejoin the same table
      // instead of losing it entirely.
      saveTableCode(isGuest, nextState.code, nextState.isSpectator ? "spectator" : "player");
    });
    socket.on("table:error", (err) => setLastError(err.message));
    socket.on("connect_error", (err) => setLastError(err.message));

    return () => {
      socket.off();
      disconnectSocket();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token, isGuest]);

  const value = useMemo<GameContextValue>(
    () => ({
      connected,
      socket,
      state,
      lastError,
      dismissError: () => setLastError(null),
      createTable: (stakeType, ante, autoWinsEnabled) =>
        new Promise<void>((resolve, reject) => {
          socketRef.current?.emit("table:create", { stakeType, ante, autoWinsEnabled }, (result) => {
            if ("message" in result) reject(new Error(result.message));
            else resolve();
          });
        }),
      joinTable: (code) =>
        new Promise<void>((resolve, reject) => {
          socketRef.current?.emit("table:join", { code }, (result) => {
            if ("message" in result) reject(new Error(result.message));
            else resolve();
          });
        }),
      spectateTable: (code) =>
        new Promise<void>((resolve, reject) => {
          socketRef.current?.emit("table:spectate", { code }, (result) => {
            if ("message" in result) reject(new Error(result.message));
            else resolve();
          });
        }),
      startInstantDemo: async () => {
        await new Promise<void>((resolve, reject) => {
          socketRef.current?.emit(
            "table:create",
            { stakeType: "chips", ante: 100, autoWinsEnabled: true },
            (result) => {
              if ("message" in result) reject(new Error(result.message));
              else resolve();
            },
          );
        });
        // Socket.io preserves emit order on one connection, so these are
        // guaranteed to be handled in sequence server-side — no need to
        // wait for individual acks before firing the next one.
        socketRef.current?.emit("table:add-bot");
        socketRef.current?.emit("table:add-bot");
        socketRef.current?.emit("table:add-bot");
        socketRef.current?.emit("table:ready", { ready: true });
      },
      leaveTable: () => {
        clearTableCode(isGuest);
        setState(null);
      },
      setReady: (ready) => socketRef.current?.emit("table:ready", { ready }),
      nextHand: () => socketRef.current?.emit("table:next-hand"),
      sendAction: (action) => socketRef.current?.emit("game:action", action),
      addBot: () => socketRef.current?.emit("table:add-bot"),
      removeBot: (playerId) => socketRef.current?.emit("table:remove-bot", { playerId }),
    }),
    [connected, socket, state, lastError, isGuest],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame debe usarse dentro de <GameProvider>");
  return ctx;
}
