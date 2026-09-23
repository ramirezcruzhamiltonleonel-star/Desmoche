import { meldLabel, type ClientHandOutcome, type ClientHandSettlement } from "@desmoche/shared";
import Card from "./Card";
import { REASON_LABELS } from "../lib/labels";

interface ReplayScenesProps {
  scene: number;
  outcome: ClientHandOutcome;
  settlement: ClientHandSettlement | null;
  winnerName: string;
}

/** Every scene this replay can show, in order — see generateReplayGif for how they're captured and timed. */
export const REPLAY_SCENE_HOLDS_MS = [2600, 3200, 2200, 1600];

const potWon = (settlement: ClientHandSettlement | null): number =>
  settlement && (settlement.kind === "chips" || settlement.kind === "money") ? settlement.potWon : 0;

/**
 * Rendered off-screen at a fixed portrait size (see the wrapper in
 * HandOverModal) — never actually shown in the normal UI, only captured
 * frame by frame into the shareable replay GIF.
 */
export default function ReplayScenes({ scene, outcome, settlement, winnerName }: ReplayScenesProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-felt-dark p-8 text-center">
      {scene === 0 && (
        <>
          <p className="mb-3 text-2xl">⚡🎉⚡</p>
          <h2 className="mb-2 font-display text-4xl text-gold">¡{winnerName} ganó!</h2>
          <p className="text-lg text-stone-200">{REASON_LABELS[outcome.reason] ?? "Mano terminada"}</p>
        </>
      )}

      {scene === 1 && (
        <>
          <p className="mb-4 text-sm uppercase tracking-widest text-gold/80">La jugada ganadora</p>
          <div className="flex flex-col items-center gap-3">
            {outcome.winningMelds.length > 0 ? (
              outcome.winningMelds.map((meld) => (
                <div key={meld.id} className="flex flex-col items-center gap-1">
                  <p className="text-xs text-stone-400">{meldLabel(meld)}</p>
                  <div className="flex gap-1">
                    {meld.cards.map((c) => (
                      <Card key={`${c.rank}-${c.suit}`} card={c} size="md" />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-stone-300">¡Mano ganada al reparto!</p>
            )}
          </div>
        </>
      )}

      {scene === 2 && (
        <>
          <p className="mb-2 text-sm uppercase tracking-widest text-gold/80">Resultado</p>
          {potWon(settlement) > 0 ? (
            <p className="font-display text-3xl text-gold">+{potWon(settlement)} fichas</p>
          ) : (
            <p className="font-display text-2xl text-gold">¡Victoria!</p>
          )}
        </>
      )}

      {scene === 3 && (
        <>
          <h2 className="mb-2 font-display text-3xl text-gold">Desmoche</h2>
          <p className="text-sm text-stone-300">Jugá gratis con tus amigos</p>
        </>
      )}
    </div>
  );
}
