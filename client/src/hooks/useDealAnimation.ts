import { useCallback, useRef, useState } from "react";
import type { Point } from "../components/FlyingCard";

interface Flight {
  id: string;
  from: Point;
  to: Point;
  delayMs: number;
}

const ROUNDS = 3;
const STAGGER_MS = 90;
const FLIGHT_DURATION_MS = 380;

function centerOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Purely decorative "dealing" flourish: a handful of card-back flights from
 * the deck to each seat in rotation order, right as a fresh hand opens. The
 * real hand is already in state by the time this plays — this never gates
 * interaction.
 */
export function useDealAnimation() {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const handTrayRef = useRef<HTMLDivElement | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);

  const registerSeatRef = useCallback((seatIndex: number, el: HTMLDivElement | null) => {
    if (el) seatRefs.current.set(seatIndex, el);
    else seatRefs.current.delete(seatIndex);
  }, []);

  const trigger = useCallback((seatOrder: number[], yourSeatIndex: number | null) => {
    const deckEl = deckRef.current;
    if (!deckEl || seatOrder.length === 0) return;
    const from = centerOf(deckEl);

    const targets: Point[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      for (const seatIndex of seatOrder) {
        const targetEl = seatIndex === yourSeatIndex ? handTrayRef.current : (seatRefs.current.get(seatIndex) ?? null);
        if (!targetEl) continue;
        targets.push(centerOf(targetEl));
      }
    }
    if (targets.length === 0) return;

    const newFlights: Flight[] = targets.map((to, i) => ({
      id: `${Date.now()}-${i}`,
      from,
      to,
      delayMs: i * STAGGER_MS,
    }));
    setFlights(newFlights);

    const totalMs = (newFlights.length - 1) * STAGGER_MS + FLIGHT_DURATION_MS + 150;
    setTimeout(() => setFlights([]), totalMs);
  }, []);

  return { deckRef, registerSeatRef, handTrayRef, flights, trigger, flightDurationMs: FLIGHT_DURATION_MS };
}
