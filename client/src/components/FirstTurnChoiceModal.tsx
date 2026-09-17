import type { Card as CardModel } from "@desmoche/shared";
import Card from "./Card";
import { cardKey } from "../lib/cardKey";

interface FirstTurnChoiceModalProps {
  cards: [CardModel, CardModel];
  onChoose: (card: CardModel) => void;
}

export default function FirstTurnChoiceModal({ cards, onChoose }: FirstTurnChoiceModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xs rounded-2xl border-4 border-wood bg-felt p-6 text-center shadow-2xl">
        <h3 className="mb-1 font-display text-lg text-gold">Robo especial del primer turno</h3>
        <p className="mb-4 text-xs text-stone-300">
          Nadie quiso la carta inicial. Elige cuál de estas dos cartas conservas — la otra se descarta.
        </p>
        <div className="flex justify-center gap-4">
          {cards.map((card) => (
            <Card key={cardKey(card)} card={card} size="lg" onClick={() => onChoose(card)} />
          ))}
        </div>
      </div>
    </div>
  );
}
