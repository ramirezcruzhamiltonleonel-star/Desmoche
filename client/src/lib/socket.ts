import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@desmoche/shared";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:4000";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let current: AppSocket | null = null;

export function connectSocket(token: string): AppSocket {
  if (current) {
    current.disconnect();
    current = null;
  }
  current = io(SERVER_URL, {
    transports: ["websocket"],
    auth: { token },
  });
  return current;
}

export function disconnectSocket(): void {
  current?.disconnect();
  current = null;
}
