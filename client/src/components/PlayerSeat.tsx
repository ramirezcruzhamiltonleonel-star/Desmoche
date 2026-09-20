import type { ClientSeatView } from "@desmoche/shared";
import CardBack from "./CardBack";

interface PlayerSeatProps {
  seat: ClientSeatView;
  isTurn: boolean;
  isDealer: boolean;
  isSpeaking?: boolean;
  /** Briefly true right after this seat's card count goes up — visible to everyone, not just the drawer, so it's obvious at a glance who's pulling from the stock. */
  isDrawing?: boolean;
  /** A reaction emoji this seat just sent (hand-over only) — floats up and fades on its own; a fresh `reactionKey` re-triggers the animation even for the same repeated emoji. */
  reactionEmoji?: string | null;
  reactionKey?: number;
  /** Used for the player's OWN seat, shown above their actual hand — the real cards are already visible right below, so a redundant card-back stack would just be clutter. */
  hideCardBacks?: boolean;
}

export default function PlayerSeat({
  seat,
  isTurn,
  isDealer,
  isSpeaking,
  isDrawing,
  reactionEmoji,
  reactionKey,
  hideCardBacks,
}: PlayerSeatProps) {
  const isOutOfHand = !seat.connected || seat.inactiveThisHand;
  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-1 transition ${
        isTurn ? "bg-gold/20 ring-2 ring-gold shadow-[0_0_14px_-2px_rgba(212,175,55,0.7)]" : ""
      } ${isSpeaking ? "ring-2 ring-green-400" : ""} ${isOutOfHand ? "opacity-60" : ""} ${
        isDrawing ? "pending-draw-glow ring-2 ring-gold" : ""
      }`}
    >
      {reactionEmoji && (
        <span
          key={reactionKey}
          aria-hidden
          className="reaction-float pointer-events-none absolute left-1/2 top-0 z-20 text-2xl"
        >
          {reactionEmoji}
        </span>
      )}
      <div className="flex items-center gap-1 whitespace-nowrap">
        {isSpeaking && <span aria-hidden className="text-xs text-green-400">🔊</span>}
        <span className={`text-xs font-semibold sm:text-sm ${seat.connected ? "text-stone-100" : "text-stone-500"}`}>
          {seat.displayName}
        </span>
        {isDealer && <span className="text-[10px] text-gold">reparte</span>}
      </div>
      {!hideCardBacks && (
        <div className="flex -space-x-5">
          {Array.from({ length: Math.min(seat.cardCount, 11) }).map((_, i) => (
            <CardBack key={i} size="sm" />
          ))}
        </div>
      )}
      {!seat.connected ? (
        <span className="text-[10px] text-red-400">Desconectado</span>
      ) : (
        seat.inactiveThisHand && <span className="text-[10px] text-red-400">Se retiró</span>
      )}
    </div>
  );
}
