import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Card as CardModel } from "@desmoche/shared";
import type { Point } from "./FlyingCard";
import Card from "./Card";
import CardBack from "./CardBack";

interface StockFlipCardProps {
  card: CardModel;
  origin: Point;
  durationMs?: number;
  onDone?: () => void;
}

/** A card-back at the stock's position flips over in place to reveal the card just drawn, then unmounts. */
export default function StockFlipCard({ card, origin, durationMs = 420, onDone }: StockFlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setFlipped(true), 20);
    const doneTimer = setTimeout(() => onDone?.(), durationMs + 260);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{
        transform: `translate(${origin.x}px, ${origin.y}px) translate(-50%, -50%)`,
        perspective: "700px",
      }}
    >
      <div
        className="relative"
        style={{
          transformStyle: "preserve-3d",
          transition: `transform ${durationMs}ms cubic-bezier(0.4, 0.1, 0.2, 1)`,
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div style={{ backfaceVisibility: "hidden" }}>
          <CardBack size="md" />
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <Card card={card} size="md" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
