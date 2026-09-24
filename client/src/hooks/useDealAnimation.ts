import { useCallback, useRef, useState } from "react";
import type { Point } from "../components/FlyingCard";
import { randomBatchSizes } from "../lib/dealOrder";

interface Flight {
  id: string;
  from: Point;
  to: Point;
  delayMs: number;
}

const CARDS_PER_SEAT = 9;
/** Offset between cards flying in the same clump — small enough to read as "together", large enough that each card is still individually visible arriving. */
const WITHIN_BATCH_STAGGER_MS = 50;
/** Pause before the next seat's clump starts, so a new pass reads as "now it's the next player's turn". */
const BETWEEN_SEAT_GAP_MS = 150;
const FLIGHT_DURATION_MS = 330;

function centerOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Purely decorative "dealing" flourish: card-back flights from the deck to
 * each seat, counter-clockwise (the same direction and starting seat as
 * normal turn rotation — see lib/dealOrder.ts), right as a fresh hand
 * opens. The real hand is already in state by the time this plays — this
 * never gates interaction.
 *
 * Mimics a physical deal: instead of one seat's full 9 cards before moving
 * on, cards go out in passes of 1-3 (varying pass to pass, never the same
 * size twice in a row) around the table, exactly 9 per seat in total.
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

    const passSizes = randomBatchSizes(CARDS_PER_SEAT);
    const newFlights: Flight[] = [];
    let cursor = 0;

    for (const batchSize of passSizes) {
      for (const seatIndex of seatOrder) {
        const targetEl = seatIndex === yourSeatIndex ? handTrayRef.current : (seatRefs.current.get(seatIndex) ?? null);
        if (!targetEl) continue;
        const to = centerOf(targetEl);
        for (let i = 0; i < batchSize; i++) {
          newFlights.push({
            id: `${Date.now()}-${newFlights.length}`,
            from,
            to,
            delayMs: cursor + i * WITHIN_BATCH_STAGGER_MS,
          });
        }
        cursor += (batchSize - 1) * WITHIN_BATCH_STAGGER_MS + BETWEEN_SEAT_GAP_MS;
      }
    }
    if (newFlights.length === 0) return;
    setFlights(newFlights);

    const totalMs = cursor + FLIGHT_DURATION_MS + 150;
    setTimeout(() => setFlights([]), totalMs);
  }, []);

  return {
    deckRef,
    registerSeatRef,
    handTrayRef,
    flights,
    trigger,
    flightDurationMs: FLIGHT_DURATION_MS,
    // Exposed so other animations (the ante-to-pot chip flight) can reuse
    // the same registered seat positions instead of tracking their own.
    seatRefs,
  };
}
