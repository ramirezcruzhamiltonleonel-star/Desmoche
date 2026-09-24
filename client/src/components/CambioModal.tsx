import { useState } from "react";
import type { Card as CardModel, ClientSeatView } from "@desmoche/shared";
import Card from "./Card";
import { cardKey } from "../lib/cardKey";

interface CambioModalProps {
  hand: CardModel[];
  submitted: boolean;
  seats: ClientSeatView[];
  submittedSeatIndices: number[];
  onSubmit: (card: CardModel) => void;
}

export default function CambioModal({
  hand,
  submitted,
  seats,
  submittedSeatIndices,
  onSubmit,
}: CambioModalProps) {
  const [selected, setSelected] = useState<CardModel | null>(null);
  // Cambio is blind and simultaneous — who actually receives this card isn't
  // known here, so there's no honest on-screen destination to fly it
  // toward. Instead the chosen card visibly lifts, shrinks and fades right
  // in the modal on submit — real movement instead of an instant swap,
  // without pretending to show a recipient that doesn't exist yet.
  const [handingOver, setHandingOver] = useState(false);

  function handleSubmit() {
    if (!selected || handingOver) return;
    setHandingOver(true);
    setTimeout(() => onSubmit(selected), 260);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 text-center shadow-2xl">
        <h3 className="mb-1 font-display text-lg text-gold">Cambio</h3>

        {submitted ? (
          <>
            <p className="mb-4 text-xs text-stone-300">
              Ya entregaste tu carta. Esperando a que los demás entreguen la suya...
            </p>
            <ul className="space-y-1 text-sm text-stone-300">
              {seats.map((seat) => (
                <li key={seat.playerId} className="flex items-center justify-between">
                  <span>{seat.displayName}</span>
                  <span className={submittedSeatIndices.includes(seat.seatIndex) ? "text-green-400" : "text-stone-500"}>
                    {submittedSeatIndices.includes(seat.seatIndex) ? "Listo" : "Eligiendo..."}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-4 text-xs text-stone-300">
              Elige 1 carta de tu mano para entregarla al siguiente jugador en la rotación. Es a
              ciegas y simultáneo — no verás lo que te dieron hasta que todos hayan entregado la
              suya.
            </p>
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              {hand.map((card) => {
                const isSelected = selected !== null && cardKey(selected) === cardKey(card);
                return (
                  <div
                    key={cardKey(card)}
                    className="transition-all duration-200 ease-out"
                    style={
                      isSelected && handingOver
                        ? { transform: "translateY(-14px) scale(0.7) rotate(-6deg)", opacity: 0 }
                        : undefined
                    }
                  >
                    <Card card={card} selected={isSelected} onClick={() => !handingOver && setSelected(card)} />
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!selected || handingOver}
              className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light disabled:opacity-40"
            >
              {handingOver ? "Entregando..." : "Entregar carta"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
