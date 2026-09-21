import type { Card as CardModel, Meld } from "@desmoche/shared";
import MeldGroup from "./MeldGroup";

interface PlayerMeldsClusterProps {
  melds: Meld[];
  size?: "xs" | "sm";
  /** "column" stacks one meld per row (narrow side seats); "row" wraps melds side by side (more width, e.g. the player's own tray). */
  direction?: "column" | "row";
  pickable?: (meld: Meld) => boolean;
  /** True while a pick is generally in progress in this cluster — used with `pickable` to dim melds that aren't legal picks right now. */
  pickInProgress?: boolean;
  onPickSourceCard?: (meldId: string, card: CardModel) => void;
  sourceCardKey?: string | null;
  /** Meld id to briefly pulse right after it just grew — see GameTable's meld-success effect. */
  highlightMeldId?: string | null;
}

/**
 * A single player's melds, laid out together so ownership reads from
 * position alone (right by that player's seat, or the viewer's own hand) —
 * never mixed in with anyone else's groups.
 */
export default function PlayerMeldsCluster({
  melds,
  size = "xs",
  direction = "column",
  pickable,
  pickInProgress = false,
  onPickSourceCard,
  sourceCardKey,
  highlightMeldId = null,
}: PlayerMeldsClusterProps) {
  if (melds.length === 0) return null;

  return (
    <div
      className={`flex w-full min-w-0 max-h-28 gap-1 overflow-y-auto ${
        direction === "row" ? "flex-row flex-wrap justify-center" : "flex-col items-center"
      }`}
    >
      {melds.map((meld) => {
        const legal = pickable?.(meld) ?? false;
        return (
          <MeldGroup
            key={meld.id}
            meld={meld}
            size={size}
            pickable={legal}
            dimmed={pickInProgress && !legal}
            justSucceeded={meld.id === highlightMeldId}
            onPickSourceCard={onPickSourceCard}
            sourceCardKey={sourceCardKey}
          />
        );
      })}
    </div>
  );
}
