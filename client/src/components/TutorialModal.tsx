import { useState } from "react";
import Card from "./Card";

interface Slide {
  title: string;
  body: string;
  example?: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: "1. Cambio",
    body: "Al repartir, cada jugador entrega 1 carta a ciegas al siguiente en la rotación. Nadie ve lo que recibió hasta que todos entregaron la suya.",
  },
  {
    title: "2. Robar y botar",
    body: "En tu turno robás del mazo (o reclamás el descarte si te sirve de inmediato) y terminás botando una carta para pasarle el turno al siguiente.",
  },
  {
    title: "3. Bajar grupo",
    body: "Tercias: 3 o 4 cartas del mismo valor, todas de palo distinto. Escaleras: 3 o más cartas seguidas del mismo palo. Bajarlos es siempre opcional.",
    example: (
      <div className="flex justify-center gap-3">
        <div className="flex gap-1">
          <Card card={{ rank: "8", suit: "spades" }} size="sm" />
          <Card card={{ rank: "8", suit: "hearts" }} size="sm" />
          <Card card={{ rank: "8", suit: "clubs" }} size="sm" />
        </div>
        <div className="flex gap-1">
          <Card card={{ rank: "5", suit: "hearts" }} size="sm" />
          <Card card={{ rank: "6", suit: "hearts" }} size="sm" />
          <Card card={{ rank: "7", suit: "hearts" }} size="sm" />
        </div>
      </div>
    ),
  },
  {
    title: "4. Desmoche",
    body: "Podés mover una carta de uno de tus grupos en mesa a otro grupo tuyo, para acomodarte mejor — siempre que el grupo de origen quede con al menos 3 cartas.",
  },
  {
    title: "5. Ganar",
    body: "Cuando tus 10 cartas quedan todas colocadas en grupos válidos, sin ninguna de sobra, ganás la mano al instante.",
  },
];

interface TutorialModalProps {
  onClose: () => void;
}

export default function TutorialModal({ onClose }: TutorialModalProps) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-wood bg-felt p-6 shadow-2xl">
        <h2 className="mb-3 text-center font-display text-xl text-gold">{slide.title}</h2>
        <p className="mb-4 text-center text-sm text-stone-200">{slide.body}</p>
        {slide.example && <div className="mb-4">{slide.example}</div>}

        <div className="mb-4 flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-gold" : "bg-stone-600"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-xs text-stone-400 underline">
            Saltar
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-lg border border-stone-500 px-4 py-1.5 text-sm text-stone-200 transition hover:border-stone-300"
              >
                Atrás
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
              className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-stone-900 transition hover:bg-gold-light"
            >
              {isLast ? "Entendido" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
