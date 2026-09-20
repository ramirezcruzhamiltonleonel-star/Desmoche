import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactionEmoji } from "@desmoche/shared";
import { useGame } from "../context/GameContext";

interface ActiveReaction {
  emoji: ReactionEmoji;
  /** Bumped on every reaction from this player so PlayerSeat's key-based re-trigger fires even for a repeated emoji. */
  key: number;
}

/** Tracks the most recent reaction per seat, auto-clearing each after it's had time to float up and fade (see .reaction-float in index.css). */
export function useReactions() {
  const { socket } = useGame();
  const [byPlayerId, setByPlayerId] = useState<Record<string, ActiveReaction>>({});
  const nextKeyRef = useRef(0);

  useEffect(() => {
    if (!socket) return;
    function onReceived({ playerId, emoji }: { playerId: string; emoji: ReactionEmoji }) {
      const key = nextKeyRef.current++;
      setByPlayerId((prev) => ({ ...prev, [playerId]: { emoji, key } }));
      setTimeout(() => {
        setByPlayerId((prev) => {
          if (prev[playerId]?.key !== key) return prev; // a newer reaction already replaced it
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }, 2200);
    }
    socket.on("reaction:received", onReceived);
    return () => {
      socket.off("reaction:received", onReceived);
    };
  }, [socket]);

  const sendReaction = useCallback(
    (emoji: ReactionEmoji) => {
      socket?.emit("reaction:send", { emoji });
    },
    [socket],
  );

  return { reactionsByPlayerId: byPlayerId, sendReaction };
}
