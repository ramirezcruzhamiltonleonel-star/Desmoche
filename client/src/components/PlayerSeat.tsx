import type { ClientSeatView } from "@desmoche/shared";
import CardBack from "./CardBack";

interface PlayerSeatProps {
  seat: ClientSeatView;
  isTurn: boolean;
  isDealer: boolean;
  isSpeaking?: boolean;
}

export default function PlayerSeat({ seat, isTurn, isDealer, isSpeaking }: PlayerSeatProps) {
  const isOutOfHand = !seat.connected || seat.inactiveThisHand;
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1 transition ${
        isTurn ? "bg-gold/20 ring-2 ring-gold shadow-[0_0_14px_-2px_rgba(212,175,55,0.7)]" : ""
      } ${isSpeaking ? "ring-2 ring-green-400" : ""} ${isOutOfHand ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-1 whitespace-nowrap">
        {isSpeaking && <span aria-hidden className="text-xs text-green-400">🔊</span>}
        <span className={`text-xs font-semibold sm:text-sm ${seat.connected ? "text-stone-100" : "text-stone-500"}`}>
          {seat.displayName}
        </span>
        {isDealer && <span className="text-[10px] text-gold">reparte</span>}
      </div>
      <div className="flex -space-x-5">
        {Array.from({ length: Math.min(seat.cardCount, 11) }).map((_, i) => (
          <CardBack key={i} size="sm" />
        ))}
      </div>
      {!seat.connected ? (
        <span className="text-[10px] text-red-400">Desconectado</span>
      ) : (
        seat.inactiveThisHand && <span className="text-[10px] text-red-400">Se retiró</span>
      )}
    </div>
  );
}
