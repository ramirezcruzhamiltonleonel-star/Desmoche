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
import { clearTableCode, loadTableCode, saveTableCode } from "../lib/tableStorage";
import { useAuth } from "./AuthContext";

interface GameContextValue {
  connected: boolean;
  /** The live socket, for features (voice chat signaling) that need to emit/listen for events GameContext doesn't otherwise model. Null until connected. */
  socket: AppSocket | null;
  state: ClientGameState | null;
  lastError: string | null;
  dismissError: () => void;
  createTable: (stakeType: StakeType, ante: number) => Promise<void>;
  joinTable: (code: string) => Promise<void>;
  leaveTable: () => void;
  setReady: (ready: boolean) => void;
  nextHand: () => void;
  sendAction: (action: GameAction) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
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
      const savedCode = loadTableCode();
      if (savedCode) {
        socket.emit("table:join", { code: savedCode }, (result) => {
          if ("message" in result) clearTableCode();
        });
      }
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("table:state", (nextState) => {
      setState(nextState);
      saveTableCode(nextState.code);
    });
    socket.on("table:error", (err) => setLastError(err.message));
    socket.on("connect_error", (err) => setLastError(err.message));

    return () => {
      socket.off();
      disconnectSocket();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  const value = useMemo<GameContextValue>(
    () => ({
      connected,
      socket,
      state,
      lastError,
      dismissError: () => setLastError(null),
      createTable: (stakeType, ante) =>
        new Promise<void>((resolve, reject) => {
          socketRef.current?.emit("table:create", { stakeType, ante }, (result) => {
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
      leaveTable: () => {
        clearTableCode();
        setState(null);
      },
      setReady: (ready) => socketRef.current?.emit("table:ready", { ready }),
      nextHand: () => socketRef.current?.emit("table:next-hand"),
      sendAction: (action) => socketRef.current?.emit("game:action", action),
    }),
    [connected, socket, state, lastError],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame debe usarse dentro de <GameProvider>");
  return ctx;
}
