import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Card as CardModel } from "@desmoche/shared";
import Card from "./Card";
import CardBack from "./CardBack";

export interface Point {
  x: number;
  y: number;
}

interface FlyingCardProps {
  from: Point;
  to: Point;
  /** Omit to fly a face-down card back (dealing); pass a card to fly it face-up (desmoche). */
  card?: CardModel;
  size?: "sm" | "md";
  delayMs?: number;
  durationMs?: number;
  onDone?: () => void;
}

/**
 * A single decorative card that flies from one screen point to another, then
 * unmounts itself. Purely cosmetic — real game state already updated the
 * instant the server responded, so this never blocks interaction
 * (pointer-events-none) and is safe to skip/interrupt.
 */
export default function FlyingCard({
  from,
  to,
  card,
  size = "sm",
  delayMs = 0,
  durationMs = 420,
  onDone,
}: FlyingCardProps) {
  const [phase, setPhase] = useState<"start" | "flying" | "done">("start");

  useEffect(() => {
    const startTimer = setTimeout(() => setPhase("flying"), Math.max(delayMs, 1));
    return () => clearTimeout(startTimer);
  }, [delayMs]);

  useEffect(() => {
    if (phase !== "flying") return undefined;
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, durationMs);
    return () => clearTimeout(doneTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, durationMs]);

  if (phase === "done") return null;

  const point = phase === "start" ? from : to;

  return createPortal(
    <div
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{
        transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) ${
          phase === "flying" ? "scale(1.08) rotate(2deg)" : "scale(1)"
        }`,
        transition: `transform ${durationMs}ms cubic-bezier(0.3, 0, 0.2, 1), opacity ${durationMs}ms ease`,
        opacity: phase === "start" ? 0.9 : 1,
      }}
    >
      {card ? <Card card={card} size={size} /> : <CardBack size={size} />}
    </div>,
    document.body,
  );
}
