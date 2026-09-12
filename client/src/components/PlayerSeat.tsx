import type { ClientSeatView } from "@desmoche/shared";
import CardBack from "./CardBack";

interface PlayerSeatProps {
  seat: ClientSeatView;
  isTurn: boolean;
  isDealer: boolean;
}

export default function PlayerSeat({ seat, isTurn, isDealer }: PlayerSeatProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1 transition ${
        isTurn ? "bg-gold/20 ring-2 ring-gold" : ""
      }`}
    >
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className={`text-xs font-semibold sm:text-sm ${seat.connected ? "text-stone-100" : "text-stone-500"}`}>
          {seat.displayName}
        </span>
        {isDealer && <span className="text-[9px] text-gold">reparte</span>}
      </div>
      <div className="flex -space-x-5">
        {Array.from({ length: Math.min(seat.cardCount, 11) }).map((_, i) => (
          <CardBack key={i} size="sm" />
        ))}
      </div>
      {!seat.connected && <span className="text-[9px] text-red-400">Desconectado</span>}
    </div>
  );
}
