import { useEffect, useRef, useState } from "react";
import type { Card as CardModel, ClientSeatView } from "@desmoche/shared";
import { useGame } from "../context/GameContext";
import { useSound } from "../hooks/useSound";
import { useVoiceChat } from "../hooks/useVoiceChat";
import { cardKey } from "../lib/cardKey";
import { STAKE_LABELS } from "../lib/labels";
import { sortHandForDisplay } from "../lib/sortHand";
import ActionBar from "./ActionBar";
import CambioModal from "./CambioModal";
import Card from "./Card";
import CardBack from "./CardBack";
import ClaimBanner from "./ClaimBanner";
import FirstTurnChoiceModal from "./FirstTurnChoiceModal";
import HandHistoryPanel from "./HandHistoryPanel";
import HandOverModal from "./HandOverModal";
import MeldsBoard from "./MeldsBoard";
import PlayerSeat from "./PlayerSeat";
import VoiceChatPanel from "./VoiceChatPanel";

type Slot = "top" | "left" | "right";

function seatSlots(count: number): Slot[] {
  if (count <= 1) return ["top"];
  if (count === 2) return ["left", "right"];
  return ["left", "top", "right"];
}

const SLOT_CLASSES: Record<Slot, string> = {
  top: "absolute left-1/2 top-2 -translate-x-1/2",
  left: "absolute left-2 top-1/2 -translate-y-1/2",
  right: "absolute right-2 top-1/2 -translate-y-1/2",
};

interface DesmocheSource {
  meldId: string;
  card: CardModel;
}

export default function GameTable() {
  const { state, sendAction, nextHand, leaveTable } = useGame();
  const sound = useSound();
  const voice = useVoiceChat();
  const [selectedCards, setSelectedCards] = useState<CardModel[]>([]);
  const [desmocheMode, setDesmocheMode] = useState(false);
  const [desmocheSource, setDesmocheSource] = useState<DesmocheSource | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const wonAlreadyRef = useRef(false);
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const prevIsYourTurnRef = useRef(false);

  useEffect(() => {
    if (state?.phase === "hand-over" && !wonAlreadyRef.current) {
      sound.playWin();
      wonAlreadyRef.current = true;
    }
    if (state?.phase !== "hand-over") {
      wonAlreadyRef.current = false;
    }
    // A fresh hand always opens on "cambio" — that's the deal.
    if (state?.phase === "cambio" && prevPhaseRef.current !== "cambio") {
      sound.playDeal();
    }
    prevPhaseRef.current = state?.phase;
    // Selections don't carry over across turns/hands.
    setSelectedCards([]);
    setDesmocheMode(false);
    setDesmocheSource(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turnSeatIndex, state?.phase]);

  useEffect(() => {
    const isYourTurnNow =
      state?.phase === "turn-active" && state.yourSeatIndex !== null && state.yourSeatIndex === state.turnSeatIndex;
    if (isYourTurnNow && !prevIsYourTurnRef.current) {
      sound.playTurn();
    }
    prevIsYourTurnRef.current = Boolean(isYourTurnNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.turnSeatIndex, state?.yourSeatIndex]);

  useEffect(() => {
    // A stock draw is never a free choice among the original 9 — pre-select
    // it so "Descartar" targets it by default, and any meld the player
    // builds naturally has to include it.
    if (state?.pendingDrawnCard) {
      setSelectedCards([state.pendingDrawnCard]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.pendingDrawnCard && cardKey(state.pendingDrawnCard)]);

  if (!state) return null;

  const yourSeat = state.seats.find((s) => s.seatIndex === state.yourSeatIndex);
  const yourPlayerId = yourSeat?.playerId ?? null;
  const isYourTurn = state.yourSeatIndex !== null && state.yourSeatIndex === state.turnSeatIndex;
  // Placing melds and desmoche stay available even while a claimed discard is
  // still pending — only the discard button itself is gated on mustPlaceCard
  // (ActionBar already disables it independently), since the player needs to
  // be able to use that exact card in a meld before they're allowed to end
  // their turn.
  const canAct = isYourTurn && state.phase === "turn-active" && state.hasDrawnThisTurn;
  const canDraw = isYourTurn && state.phase === "turn-active" && !state.hasDrawnThisTurn;
  const myMelds = state.melds.filter((m) => m.ownerId === yourPlayerId);
  const nameByPlayerId = Object.fromEntries(state.seats.map((s) => [s.playerId, s.displayName]));

  const yourIndexSafe = state.yourSeatIndex ?? 0;
  const others: ClientSeatView[] = [];
  for (let offset = 1; offset < state.seats.length; offset++) {
    const seatIndex = (yourIndexSafe + offset) % state.seats.length;
    const seat = state.seats.find((s) => s.seatIndex === seatIndex);
    if (seat) others.push(seat);
  }
  const slots = seatSlots(others.length);

  const isClaimEligible =
    state.phase === "claim-window" &&
    state.claim !== null &&
    state.yourSeatIndex !== null &&
    state.claim.pendingSeatIndices.includes(state.yourSeatIndex);

  function toggleHandCard(card: CardModel) {
    const key = cardKey(card);
    setSelectedCards((prev) =>
      prev.some((c) => cardKey(c) === key) ? prev.filter((c) => cardKey(c) !== key) : [...prev, card],
    );
  }

  function handleDraw() {
    sendAction({ type: "draw-stock" });
    sound.playDraw();
  }

  function handlePlaceMeld() {
    sendAction({ type: "place-meld", cards: selectedCards });
    setSelectedCards([]);
    sound.playMeld();
  }

  function handleExtend(meldId: string) {
    sendAction({ type: "extend-meld", meldId, cards: selectedCards });
    setSelectedCards([]);
    sound.playMeld();
  }

  function handleDiscard() {
    if (selectedCards.length !== 1) return;
    sendAction({ type: "discard", card: selectedCards[0]! });
    setSelectedCards([]);
    sound.playDiscard();
  }

  function handlePickDesmocheSource(meldId: string, card: CardModel) {
    setDesmocheSource({ meldId, card });
  }

  function handlePickDesmocheDestination(meldId: string) {
    if (!desmocheSource) return;
    sendAction({
      type: "desmochar",
      fromMeldId: desmocheSource.meldId,
      toMeldId: meldId,
      card: desmocheSource.card,
    });
    setDesmocheSource(null);
    setDesmocheMode(false);
    sound.playDesmochar();
  }

  const winnerName = state.handOutcome
    ? (state.seats.find((s) => s.seatIndex === state.handOutcome!.winnerSeatIndex)?.displayName ?? "?")
    : "";

  return (
    <div className="screen-fade flex min-h-screen flex-col bg-felt-dark">
      <header className="flex items-center justify-between px-3 py-2 text-xs text-stone-300">
        <span>
          Mesa {state.code} · {STAKE_LABELS[state.stakeType]}
          {state.stakeType === "chips" ? ` · ante ${state.ante}` : ""}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHistory(true)} aria-label="Historial de la mesa" className="text-base">
            📜
          </button>
          <button onClick={sound.toggle} aria-label="Sonido" className="text-base">
            {sound.enabled ? "🔊" : "🔇"}
          </button>
          <button onClick={leaveTable} className="underline">
            Salir
          </button>
        </div>
      </header>

      <div className="flex justify-end px-3 pb-2">
        <VoiceChatPanel
          voice={voice}
          isSelfSpeaking={Boolean(yourPlayerId && voice.speakingPlayerIds.has(yourPlayerId))}
          nameByPlayerId={nameByPlayerId}
        />
      </div>

      <div
        className="relative mx-3 mb-3 flex-1 rounded-[2.5rem] border-8 border-wood bg-felt shadow-inner"
        style={{ minHeight: "50vh" }}
      >
        {others.map((seat, i) => (
          <div key={seat.playerId} className={SLOT_CLASSES[slots[i]!]}>
            <PlayerSeat
              seat={seat}
              isTurn={seat.seatIndex === state.turnSeatIndex}
              isDealer={seat.seatIndex === state.dealerSeatIndex}
              isSpeaking={voice.speakingPlayerIds.has(seat.playerId)}
            />
          </div>
        ))}

        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 px-2">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <CardBack size="md" />
              <span className="text-[10px] text-stone-400">Mazo ({state.stockCount})</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {state.topDiscard ? (
                <Card card={state.topDiscard} size="md" />
              ) : (
                <div className="h-20 w-14 rounded-md border-2 border-dashed border-stone-600" />
              )}
              <span className="text-[10px] text-stone-400">Descarte</span>
            </div>
          </div>
          <div className="max-h-40 w-full overflow-y-auto">
            <MeldsBoard
              melds={state.melds}
              seatNameByPlayerId={nameByPlayerId}
              canPickSourceFrom={(meld) => desmocheMode && meld.ownerId === yourPlayerId && !desmocheSource}
              onPickSourceCard={handlePickDesmocheSource}
              sourceCardKey={desmocheSource ? cardKey(desmocheSource.card) : null}
            />
          </div>
        </div>
      </div>

      {state.phase === "claim-window" && state.claim && (
        <ClaimBanner
          claim={state.claim}
          isEligible={isClaimEligible}
          onRespond={(response) => sendAction({ type: "respond-claim", response })}
        />
      )}

      <div
        className={`border-t bg-black/20 px-3 py-3 transition-colors ${
          isYourTurn && state.phase === "turn-active"
            ? "border-gold shadow-[0_-2px_16px_-2px_rgba(212,175,55,0.5)]"
            : "border-wood/60"
        }`}
      >
        {isYourTurn && state.phase === "turn-active" && (
          <p className="mb-2 animate-pulse text-center text-xs font-bold uppercase tracking-widest text-gold">
            ★ Tu turno ★
          </p>
        )}
        <div className="mb-2 flex justify-center gap-2 overflow-x-auto pb-2">
          {sortHandForDisplay(state.yourHand).map((card) => (
            <Card
              key={cardKey(card)}
              card={card}
              selected={selectedCards.some((c) => cardKey(c) === cardKey(card))}
              onClick={() => toggleHandCard(card)}
            />
          ))}
        </div>

        <ActionBar
          isYourTurn={isYourTurn}
          isTurnActivePhase={state.phase === "turn-active"}
          canDraw={canDraw}
          onDraw={handleDraw}
          canAct={canAct}
          selectedCount={selectedCards.length}
          onPlaceMeld={handlePlaceMeld}
          myMelds={myMelds}
          onExtend={handleExtend}
          onDiscard={handleDiscard}
          mustPlaceCard={state.mustPlaceCard}
          pendingDrawnCard={state.pendingDrawnCard}
          desmocheMode={desmocheMode}
          onToggleDesmoche={() => {
            setDesmocheMode((prev) => !prev);
            setDesmocheSource(null);
          }}
          desmocheSource={desmocheSource}
          onPickDestination={handlePickDesmocheDestination}
        />
      </div>

      {state.phase === "cambio" && (
        <CambioModal
          hand={state.yourHand}
          submitted={state.yourCambioSubmitted}
          seats={state.seats}
          submittedSeatIndices={state.cambio?.submittedSeatIndices ?? []}
          onSubmit={(card) => sendAction({ type: "submit-cambio-card", card })}
        />
      )}

      {state.phase === "first-turn-choice" && state.yourFirstTurnChoice && (
        <FirstTurnChoiceModal
          cards={state.yourFirstTurnChoice}
          onChoose={(card) => sendAction({ type: "choose-first-turn-card", card })}
        />
      )}

      {state.phase === "hand-over" && state.handOutcome && (
        <HandOverModal
          outcome={state.handOutcome}
          settlement={state.handSettlement}
          nameByPlayerId={nameByPlayerId}
          winnerName={winnerName}
          onNextHand={nextHand}
        />
      )}

      {showHistory && (
        <HandHistoryPanel state={state} nameByPlayerId={nameByPlayerId} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
