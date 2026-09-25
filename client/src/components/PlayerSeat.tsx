import type { ClientSeatView } from "@desmoche/shared";
import CardBack from "./CardBack";
import ChipToken from "./ChipToken";
import DealerButton from "./DealerButton";
import SeatAvatar from "./SeatAvatar";

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
  /** Spectator mode: renders hidden opponent card-backs under a translucent mist. */
  foggy?: boolean;
  /** Chips/money running total for the whole table session — omitted entirely in dare mode, where it's meaningless. */
  chipsBalance?: number | null;
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
  foggy,
  chipsBalance,
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
          // z-[65]: reactions can ONLY be sent during hand-over, which means
          // HandOverModal (z-40, bg-black/70) is covering the whole felt
          // the entire time one is playing — at the old z-20 the animation
          // ran, but entirely hidden behind that overlay, so nobody but the
          // sender (via the button's own ring) ever saw anything (reported
          // bug). Above the header's z-[60] too, for the same reason.
          className="reaction-float pointer-events-none absolute left-1/2 top-0 z-[65] text-2xl"
        >
          {reactionEmoji}
        </span>
      )}
      <div className="relative">
        <SeatAvatar avatar={seat.avatar} displayName={seat.displayName} />
        {isDealer && <DealerButton />}
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        {isSpeaking && <span aria-hidden className="text-xs text-green-400">🔊</span>}
        <span className={`text-xs font-semibold sm:text-sm ${seat.connected ? "text-stone-100" : "text-stone-500"}`}>
          {seat.displayName}
        </span>
      </div>
      {chipsBalance !== undefined && chipsBalance !== null && (
        <span className="flex items-center gap-1">
          <ChipToken
            size="sm"
            denomination={chipsBalance > 0 ? "gold" : chipsBalance < 0 ? "bronze" : "silver"}
          />
          <span
            className={`text-[10px] font-semibold tabular-nums ${
              chipsBalance > 0 ? "text-green-400" : chipsBalance < 0 ? "text-red-400" : "text-stone-400"
            }`}
          >
            {chipsBalance > 0 ? "+" : ""}
            {chipsBalance} fichas
          </span>
        </span>
      )}
      {!hideCardBacks && (
        <div className="flex -space-x-5">
          {Array.from({ length: Math.min(seat.cardCount, 11) }).map((_, i) => (
            <CardBack key={i} size="sm" foggy={foggy} />
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
