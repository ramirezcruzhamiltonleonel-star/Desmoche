import type { Card as CardModel } from "@desmoche/shared";
import Card from "./Card";

interface RulesPageProps {
  onClose: () => void;
}

function ExampleRow({ cards }: { cards: CardModel[] }) {
  return (
    <div className="flex justify-center gap-1">
      {cards.map((c) => (
        <Card key={`${c.rank}-${c.suit}`} card={c} size="sm" />
      ))}
    </div>
  );
}

export default function RulesPage({ onClose }: RulesPageProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-2xl border-4 border-wood bg-felt shadow-2xl">
        <div className="flex items-center justify-between border-b border-wood-dark px-5 py-3">
          <h2 className="font-display text-xl text-gold">Reglas del Desmoche</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-stone-300 hover:text-gold">
            ✕
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-1 font-display text-lg text-gold">El objetivo</h3>
            <p className="text-sm text-stone-200">
              Bajá tercias y escaleras hasta que las 10 cartas de tu mano queden todas colocadas en
              grupos válidos, sin ninguna de sobra — ahí ganás la mano al instante.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-display text-lg text-gold">Cambio</h3>
            <p className="text-sm text-stone-200">
              Al repartir, cada jugador entrega 1 carta a ciegas al siguiente en la rotación. Nadie ve
              lo que recibió hasta que todos entregaron la suya.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-display text-lg text-gold">Tercias y escaleras</h3>
            <p className="mb-2 text-sm text-stone-200">
              Tercia: 3 o 4 cartas del mismo valor, todas de palo distinto. Escalera: 3 o más cartas
              seguidas del mismo palo.
            </p>
            <div className="flex justify-center gap-3">
              <ExampleRow
                cards={[
                  { rank: "8", suit: "spades" },
                  { rank: "8", suit: "hearts" },
                  { rank: "8", suit: "clubs" },
                ]}
              />
              <ExampleRow
                cards={[
                  { rank: "5", suit: "hearts" },
                  { rank: "6", suit: "hearts" },
                  { rank: "7", suit: "hearts" },
                ]}
              />
            </div>
          </section>

          <section>
            <h3 className="mb-1 font-display text-lg text-gold">Desmoche</h3>
            <p className="text-sm text-stone-200">
              Podés mover una carta de uno de tus grupos en mesa a otro grupo tuyo (o a uno nuevo),
              siempre que el grupo de origen quede con al menos 3 cartas.
            </p>
          </section>

          <div className="border-t border-wood-dark pt-4">
            <p className="mb-3 text-center text-xs uppercase tracking-widest text-stone-400">
              Jugadas especiales
            </p>

            <section className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <h3 className="mb-1 font-display text-base text-gold">⚡ Peladía</h3>
              <p className="mb-2 text-sm text-stone-200">
                Tu mano recién repartida no tiene ni pares ni 2 o más cartas seguidas del mismo palo
                — gana de inmediato, antes de que nadie juegue.
              </p>
              <ExampleRow
                cards={[
                  { rank: "2", suit: "spades" },
                  { rank: "5", suit: "hearts" },
                  { rank: "9", suit: "diamonds" },
                  { rank: "K", suit: "clubs" },
                  { rank: "4", suit: "spades" },
                  { rank: "7", suit: "hearts" },
                  { rank: "J", suit: "diamonds" },
                  { rank: "3", suit: "clubs" },
                  { rank: "6", suit: "spades" },
                ]}
              />
              <p className="mt-1 text-center text-[10px] text-stone-500">
                Ningún valor repetido, y ningún palo con 2 cartas seguidas (2♠-4♠-6♠ tienen huecos).
              </p>
            </section>

            <section className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <h3 className="mb-1 font-display text-base text-gold">⚡ Cuatro Cuerpos</h3>
              <p className="mb-2 text-sm text-stone-200">
                Te repartieron las 4 cartas del mismo valor — gana de inmediato, igual que una
                Peladía. Si hay empate entre varios, gana el más cercano a la derecha del repartidor.
              </p>
              <ExampleRow
                cards={[
                  { rank: "8", suit: "spades" },
                  { rank: "8", suit: "hearts" },
                  { rank: "8", suit: "diamonds" },
                  { rank: "8", suit: "clubs" },
                ]}
              />
            </section>

            <section className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <h3 className="mb-1 font-display text-base text-gold">💰 Mico abajo</h3>
              <p className="mb-2 text-sm text-stone-200">
                Tu jugada ganadora incluye una escalera A-2-3 del mismo palo — cada perdedor te paga
                un ante extra, además del pozo normal.
              </p>
              <ExampleRow
                cards={[
                  { rank: "A", suit: "hearts" },
                  { rank: "2", suit: "hearts" },
                  { rank: "3", suit: "hearts" },
                ]}
              />
            </section>

            <section className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <h3 className="mb-1 font-display text-base text-gold">💰 Mico arriba</h3>
              <p className="mb-2 text-sm text-stone-200">
                Igual que el Mico abajo, pero con una escalera Q-K-A del mismo palo. Se acumula con
                el Mico abajo si ambos aplican en la misma mano.
              </p>
              <ExampleRow
                cards={[
                  { rank: "Q", suit: "spades" },
                  { rank: "K", suit: "spades" },
                  { rank: "A", suit: "spades" },
                ]}
              />
            </section>

            <section className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <h3 className="mb-1 font-display text-base text-gold">💰 Patona</h3>
              <p className="text-sm text-stone-200">
                Si un perdedor no bajó <strong>ningún</strong> grupo en toda la mano, le debe al
                ganador un ante extra adicional (el mismo monto que un Mico, por un motivo distinto)
                — se acumula con los Micos. No aplica sobre una Peladía/Cuatro Cuerpos (ahí nadie
                llegó a tener turno) ni en Modo Retos.
              </p>
            </section>

            <section className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
              <h3 className="mb-1 font-display text-base text-gold">🃏 Oro, Corazón y Flor</h3>
              <p className="mb-2 text-sm text-stone-200">
                Cerrar la mano usando <strong>solo escaleras</strong> (nunca tercias) de un mismo palo
                dispara un bono extra: todo diamante paga <strong>Oro</strong> (2 antes por
                oponente), todo corazones paga <strong>Corazón</strong> (2 antes por oponente), y
                cualquier otro palo repetido en toda la jugada paga <strong>Flor</strong> (1.5 antes
                por oponente). Oro y Corazón también cuentan como Flor a la vez — se acumulan entre
                sí y con los Micos.
              </p>
              <ExampleRow
                cards={[
                  { rank: "2", suit: "diamonds" },
                  { rank: "3", suit: "diamonds" },
                  { rank: "4", suit: "diamonds" },
                ]}
              />
            </section>
          </div>
        </div>

        <div className="border-t border-wood-dark px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
