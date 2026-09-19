import { useEffect, useRef, useState } from "react";
import {
  canDesmocharFrom,
  canUseDiscardImmediately,
  isValidMeld,
  type Card as CardModel,
  type ClientSeatView,
} from "@desmoche/shared";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import { useTheme } from "../context/ThemeContext";
import { useDealAnimation } from "../hooks/useDealAnimation";
import { useSound } from "../hooks/useSound";
import { useVoiceChat } from "../hooks/useVoiceChat";
import { arrangeHandForDisplay } from "../lib/arrangeHand";
import { buildDealOrder } from "../lib/dealOrder";
import { cardKey } from "../lib/cardKey";
import { saveGuestNameHint } from "../lib/guestNameHint";
import { computeGuestSummary } from "../lib/guestSummary";
import { STAKE_LABELS } from "../lib/labels";
import { sortHandForDisplay } from "../lib/sortHand";
import { THEME_LABELS, THEMES } from "../lib/themeStorage";
import { hasTutorialBeenSeen, markTutorialSeen } from "../lib/tutorialStorage";
import { vibrate } from "../lib/vibration";
import ActionBar from "./ActionBar";
import CambioModal from "./CambioModal";
import Card from "./Card";
import CardBack from "./CardBack";
import ClaimBanner from "./ClaimBanner";
import FlyingCard, { type Point } from "./FlyingCard";
import GuestSummaryModal from "./GuestSummaryModal";
import HandHistoryPanel from "./HandHistoryPanel";
import HandOverModal from "./HandOverModal";
import PlayerMeldsCluster from "./PlayerMeldsCluster";
import PlayerSeat from "./PlayerSeat";
import StockFlipCard from "./StockFlipCard";
import TutorialModal from "./TutorialModal";
import VoiceChatPanel from "./VoiceChatPanel";

interface DesmocheFlight {
  from: Point;
  to: Point;
  card: CardModel;
}

interface StockFlip {
  card: CardModel;
  origin: Point;
}

type Slot = "top" | "left" | "right";

function seatSlots(count: number): Slot[] {
  if (count <= 1) return ["top"];
  if (count === 2) return ["left", "right"];
  return ["left", "top", "right"];
}

/**
 * A CSS Grid template for the felt's opponent/center layout, keyed to how
 * many opponents are seated. Each region (top / left / center / right) gets
 * its own reserved track — however tall a player's melds grow, the row just
 * grows with them instead of spilling into a neighboring region. `minmax(0,
 * Nfr)` on the side columns is what makes that hold even under a fr-based
 * width: without the explicit 0 minimum, a track refuses to shrink below
 * its content's natural size, which is exactly the old overlap bug.
 */
function feltGridTemplate(otherCount: number): { areas: string; columns: string; rows: string } {
  if (otherCount <= 1) {
    return { areas: '"top" "center"', columns: "1fr", rows: "auto 1fr" };
  }
  if (otherCount === 2) {
    return {
      areas: '"left center right"',
      columns: "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)",
      rows: "1fr",
    };
  }
  return {
    areas: '"top top top" "left center right"',
    columns: "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)",
    rows: "auto 1fr",
  };
}

interface DesmocheSource {
  meldId: string;
  card: CardModel;
}

export default function GameTable() {
  const { state, sendAction, nextHand, leaveTable } = useGame();
  const { isGuest, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const sound = useSound();
  const voice = useVoiceChat();
  const dealAnim = useDealAnimation();
  const [selectedCards, setSelectedCards] = useState<CardModel[]>([]);
  const [desmocheMode, setDesmocheMode] = useState(false);
  const [desmocheSource, setDesmocheSource] = useState<DesmocheSource | null>(null);
  const [desmocheFlight, setDesmocheFlight] = useState<DesmocheFlight | null>(null);
  const [stockFlip, setStockFlip] = useState<StockFlip | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showGuestSummary, setShowGuestSummary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !hasTutorialBeenSeen());
  const [handArranged, setHandArranged] = useState(false);
  const [confirmingRetire, setConfirmingRetire] = useState(false);
  const [reshuffleNotice, setReshuffleNotice] = useState(false);
  const [drawingSeatIndex, setDrawingSeatIndex] = useState<number | null>(null);
  const wonAlreadyRef = useRef(false);
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const prevIsYourTurnRef = useRef(false);
  const prevStockCountRef = useRef<number | undefined>(undefined);
  const prevCardCountsRef = useRef<Record<number, number>>({});

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
      dealAnim.trigger(buildDealOrder(state.dealerSeatIndex, state.seats.length), state.yourSeatIndex);
      setHandArranged(false);
      // A brand-new deal's full stock is not a "reshuffle" of this hand's
      // discard pile — don't let the very first comparison after this
      // treat it as one.
      prevStockCountRef.current = undefined;
    }
    prevPhaseRef.current = state?.phase;
    // Selections don't carry over across turns/hands.
    setSelectedCards([]);
    setDesmocheMode(false);
    setDesmocheSource(null);
    setConfirmingRetire(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turnSeatIndex, state?.phase]);

  useEffect(() => {
    const isYourTurnNow =
      state?.phase === "turn-active" && state.yourSeatIndex !== null && state.yourSeatIndex === state.turnSeatIndex;
    if (isYourTurnNow && !prevIsYourTurnRef.current) {
      sound.playTurn();
      // Especially useful with voice chat going — a buzz cuts through a
      // distracted conversation better than a beep alone. Tied to the same
      // sound toggle rather than a separate setting, and simply does
      // nothing on platforms without the Vibration API (desktop, iOS).
      if (sound.enabled) vibrate(200);
    }
    prevIsYourTurnRef.current = Boolean(isYourTurnNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.turnSeatIndex, state?.yourSeatIndex]);

  useEffect(() => {
    // Stock can only ever go DOWN as cards are drawn (or stay put) — the
    // one exception is the discard pile getting recycled back into the
    // stock once it hits 0 ("se va doble" territory otherwise). Surface
    // that moment explicitly so the count visibly jumping up never reads
    // as cards appearing from nowhere.
    const isReshuffle =
      state && prevStockCountRef.current !== undefined && state.stockCount > prevStockCountRef.current;
    prevStockCountRef.current = state?.stockCount;
    if (isReshuffle) {
      setReshuffleNotice(true);
      const timer = setTimeout(() => setReshuffleNotice(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state?.stockCount]);

  useEffect(() => {
    // Whoever's card count just went up drew from the stock (or claimed a
    // discard) — visible to every viewer via cardCount alone, so this needs
    // no new server state. Briefly highlight that seat so it's obvious at a
    // glance who's acting, without exposing which card it was.
    if (!state) return;
    const prev = prevCardCountsRef.current;
    const grown = state.seats.find((seat) => {
      const before = prev[seat.seatIndex];
      return before !== undefined && seat.cardCount > before;
    });
    prevCardCountsRef.current = Object.fromEntries(state.seats.map((s) => [s.seatIndex, s.cardCount]));
    if (grown) {
      setDrawingSeatIndex(grown.seatIndex);
      const timer = setTimeout(() => setDrawingSeatIndex(null), 1600);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.seats.map((s) => s.cardCount).join(",")]);

  useEffect(() => {
    // A stock draw is never a free choice among the original 9 — pre-select
    // it so "Descartar" targets it by default, and any meld the player
    // builds naturally has to include it.
    if (state?.pendingDrawnCard) {
      setSelectedCards([state.pendingDrawnCard]);
      const deckEl = dealAnim.deckRef.current;
      if (deckEl) {
        const rect = deckEl.getBoundingClientRect();
        setStockFlip({
          card: state.pendingDrawnCard,
          origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        });
      }
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
  const feltGrid = feltGridTemplate(others.length);

  const isClaimEligible =
    state.phase === "claim-window" &&
    state.claim !== null &&
    state.yourSeatIndex !== null &&
    state.claim.pendingSeatIndices.includes(state.yourSeatIndex);
  const canClaim =
    isClaimEligible && state.claim !== null && canUseDiscardImmediately(state.yourHand, state.claim.card, myMelds);

  // A stock draw is never a free choice — whatever's selected must include it
  // before placing/extending is allowed to go through (mirrors the server's
  // assertPendingDrawnCardIncluded). A claimed discard (mustPlaceCard) works
  // the same way but doesn't force a specific selection beyond "place it".
  const requiredCard = state.pendingDrawnCard;
  const selectionIncludesRequired =
    !requiredCard || selectedCards.some((c) => cardKey(c) === cardKey(requiredCard));
  const canPlaceMeld = selectionIncludesRequired && isValidMeld(selectedCards);
  const extendableMeldIds = new Set(
    selectedCards.length > 0 && selectionIncludesRequired
      ? myMelds.filter((meld) => isValidMeld([...meld.cards, ...selectedCards])).map((meld) => meld.id)
      : [],
  );
  const canDiscardSelection =
    selectedCards.length === 1 &&
    !state.mustPlaceCard &&
    (!requiredCard || cardKey(selectedCards[0]!) === cardKey(requiredCard));
  const canDesmoche = myMelds.some((meld) => canDesmocharFrom(meld.cards));
  const validDesmocheDestinationIds = new Set(
    desmocheSource
      ? myMelds
          .filter((meld) => meld.id !== desmocheSource.meldId && isValidMeld([...meld.cards, desmocheSource.card]))
          .map((meld) => meld.id)
      : [],
  );

  // Available any time after Cambio (claim window or your turn) — Cambio
  // itself is mandatory, blind, and simultaneous, so retiring mid-Cambio
  // wouldn't mean anything yet.
  const canRetire = Boolean(yourSeat) && !yourSeat!.inactiveThisHand && state.phase !== "cambio";

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

  function handleCloseTutorial() {
    markTutorialSeen();
    setShowTutorial(false);
  }

  function handleRetire() {
    sendAction({ type: "retire-from-hand" });
    setConfirmingRetire(false);
  }

  function handleLeaveClick() {
    // A guest who's actually played something gets one chance to see what
    // they'd lose before it's gone — real accounts leave immediately like
    // always, nothing changes for them.
    if (isGuest && state && state.handHistory.length > 0) {
      setShowGuestSummary(true);
      return;
    }
    leaveTable();
  }

  function handleCreateAccountFromSummary() {
    if (yourSeat) saveGuestNameHint(yourSeat.displayName);
    setShowGuestSummary(false);
    // Unmounts <GameProvider> (which disconnects the socket in its own
    // cleanup) and routes back to <LoginScreen/> — nothing else to tear
    // down first, since a guest's table code was never saved to begin with.
    logout();
  }

  function handlePickDesmocheDestination(meldId: string) {
    if (!desmocheSource) return;
    const sourceEl = document.querySelector<HTMLElement>(
      `[data-meld-id="${desmocheSource.meldId}"] [data-card-key="${cardKey(desmocheSource.card)}"]`,
    );
    const destEl = document.querySelector<HTMLElement>(`[data-meld-id="${meldId}"]`);
    if (sourceEl && destEl) {
      const fromRect = sourceEl.getBoundingClientRect();
      const toRect = destEl.getBoundingClientRect();
      setDesmocheFlight({
        from: { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
        to: { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 },
        card: desmocheSource.card,
      });
    }
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

  const winnerName =
    state.handOutcome && state.handOutcome.winnerSeatIndex !== null
      ? (state.seats.find((s) => s.seatIndex === state.handOutcome!.winnerSeatIndex)?.displayName ?? "?")
      : "";

  return (
    <div className="screen-fade flex min-h-screen flex-col bg-felt-dark">
      <header className="flex items-center justify-between px-3 py-2 text-xs text-stone-300">
        <span>
          Mesa {state.code} · {STAKE_LABELS[state.stakeType]}
          {state.stakeType === "chips" ? ` · ante ${state.ante}` : ""}
          {state.accumulatedPot > 0 ? ` · pozo acumulado ${state.accumulatedPot}` : ""}
          {!state.autoWinsEnabled ? " · sin automáticas" : ""}
          {isGuest ? " · 👤 invitado (no se guarda)" : ""}
        </span>
        <div className="flex items-center gap-3">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as (typeof THEMES)[number])}
            aria-label="Tema visual de la mesa"
            className="rounded border border-wood-dark bg-stone-900 px-1 py-0.5 text-[10px] text-stone-300"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                🎨 {THEME_LABELS[t]}
              </option>
            ))}
          </select>
          <button onClick={() => setShowTutorial(true)} aria-label="Cómo se juega" className="p-1 text-base">
            ❓
          </button>
          <button onClick={() => setShowHistory(true)} aria-label="Historial de la mesa" className="p-1 text-base">
            📜
          </button>
          <button onClick={sound.toggle} aria-label="Sonido" className="p-1 text-base">
            {sound.enabled ? "🔊" : "🔇"}
          </button>
          <button onClick={handleLeaveClick} className="p-1 underline">
            Salir
          </button>
        </div>
      </header>

      <div className="flex justify-end px-3 pb-2">
        {isGuest ? (
          <span className="text-[10px] text-stone-500">🎙️ Chat de voz — creá una cuenta para usarlo</span>
        ) : (
          <VoiceChatPanel
            voice={voice}
            isSelfSpeaking={Boolean(yourPlayerId && voice.speakingPlayerIds.has(yourPlayerId))}
            nameByPlayerId={nameByPlayerId}
          />
        )}
      </div>

      <div
        className="mx-3 mb-3 grid flex-1 items-center justify-items-center gap-x-1 gap-y-3 rounded-[2.5rem] border-8 border-wood bg-felt p-2 shadow-inner sm:gap-x-3 sm:p-4"
        style={{
          minHeight: "58vh",
          gridTemplateAreas: feltGrid.areas,
          gridTemplateColumns: feltGrid.columns,
          gridTemplateRows: feltGrid.rows,
        }}
      >
        {others.map((seat, i) => (
          <div
            key={seat.playerId}
            ref={(el) => dealAnim.registerSeatRef(seat.seatIndex, el)}
            style={{ gridArea: slots[i] }}
            // min-w-0 overrides a grid/flex item's default "never shrink
            // below content size" — without it, a wide meld cluster ignores
            // the track width entirely and spills into the neighboring
            // area instead of scrolling within its own box.
            className="flex w-full min-w-0 flex-col items-center gap-1 justify-self-center"
          >
            <PlayerSeat
              seat={seat}
              isTurn={seat.seatIndex === state.turnSeatIndex}
              isDealer={seat.seatIndex === state.dealerSeatIndex}
              isSpeaking={voice.speakingPlayerIds.has(seat.playerId)}
              isDrawing={seat.seatIndex === drawingSeatIndex}
            />
            <PlayerMeldsCluster melds={state.melds.filter((m) => m.ownerId === seat.playerId)} size="xs" />
          </div>
        ))}

        <div style={{ gridArea: "center" }} className="flex w-full min-w-0 flex-col items-center gap-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <div ref={dealAnim.deckRef} className="flex flex-col items-center gap-1">
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
          {reshuffleNotice && (
            <p className="animate-pulse rounded-full border border-gold/60 bg-stone-900/80 px-3 py-1 text-[10px] font-semibold text-gold">
              🔄 Se recicló el descarte — el mazo vuelve a tener cartas
            </p>
          )}
        </div>
      </div>

      {state.phase === "claim-window" && state.claim && (
        <ClaimBanner
          claim={state.claim}
          isEligible={isClaimEligible}
          canClaim={canClaim}
          onRespond={(response) => sendAction({ type: "respond-claim", response })}
        />
      )}

      <div
        ref={dealAnim.handTrayRef}
        className={`border-t bg-black/20 px-3 py-3 transition-colors ${
          isYourTurn && state.phase === "turn-active"
            ? "border-gold shadow-[0_-2px_16px_-2px_rgba(212,175,55,0.5)]"
            : "border-wood/60"
        }`}
      >
        {state.isSpectator ? (
          <p className="py-3 text-center text-xs text-stone-400">
            👁 Modo espectador — estás mirando esta mesa sin participar.
          </p>
        ) : (
          <>
            {isYourTurn && state.phase === "turn-active" && (
              <p className="mb-2 animate-pulse text-center text-xs font-bold uppercase tracking-widest text-gold">
                ★ Tu turno ★
              </p>
            )}
            {canRetire && (
              <div className="mb-1 flex justify-start">
                {!confirmingRetire ? (
                  <button
                    onClick={() => setConfirmingRetire(true)}
                    className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-900/50"
                  >
                    Retirarme de la mano
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-red-300">¿Seguro? No podrás volver a jugar esta mano.</span>
                    <button
                      onClick={handleRetire}
                      className="rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
                    >
                      Sí, retirarme
                    </button>
                    <button
                      onClick={() => setConfirmingRetire(false)}
                      className="rounded-lg border border-stone-500 px-3 py-1 text-xs text-stone-300 transition hover:border-stone-300"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="mb-1 flex justify-end">
              <button
                onClick={() => setHandArranged((prev) => !prev)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                  handArranged ? "border-gold bg-gold/10 text-gold" : "border-stone-500 text-stone-300 hover:border-gold"
                }`}
              >
                {handArranged ? "Orden normal" : "Acomodar"}
              </button>
            </div>
            {myMelds.length > 0 && (
              <div className="mb-2">
                <PlayerMeldsCluster
                  melds={myMelds}
                  size="sm"
                  direction="row"
                  pickable={(meld) => desmocheMode && !desmocheSource && canDesmocharFrom(meld.cards)}
                  pickInProgress={desmocheMode && !desmocheSource}
                  onPickSourceCard={handlePickDesmocheSource}
                  sourceCardKey={desmocheSource ? cardKey(desmocheSource.card) : null}
                />
              </div>
            )}
            <div className="mb-2 flex justify-center gap-2 overflow-x-auto pb-2">
              {(handArranged ? arrangeHandForDisplay(state.yourHand) : sortHandForDisplay(state.yourHand)).map(
                (card) => (
                  <Card
                    key={cardKey(card)}
                    card={card}
                    selected={selectedCards.some((c) => cardKey(c) === cardKey(card))}
                    pendingDraw={Boolean(
                      state.pendingDrawnCard && cardKey(state.pendingDrawnCard) === cardKey(card),
                    )}
                    onClick={() => toggleHandCard(card)}
                  />
                ),
              )}
            </div>

            {yourSeat?.inactiveThisHand ? (
              <p className="px-3 pb-2 text-center text-xs text-red-300">
                Te retiraste de esta mano — esperá a que termine para volver a jugar.
              </p>
            ) : (
              <ActionBar
                isYourTurn={isYourTurn}
                isTurnActivePhase={state.phase === "turn-active"}
                canDraw={canDraw}
                onDraw={handleDraw}
                canAct={canAct}
                selectedCount={selectedCards.length}
                canPlaceMeld={canPlaceMeld}
                onPlaceMeld={handlePlaceMeld}
                myMelds={myMelds}
                extendableMeldIds={extendableMeldIds}
                onExtend={handleExtend}
                canDiscardSelection={canDiscardSelection}
                onDiscard={handleDiscard}
                mustPlaceCard={state.mustPlaceCard}
                pendingDrawnCard={state.pendingDrawnCard}
                canDesmoche={canDesmoche}
                desmocheMode={desmocheMode}
                onToggleDesmoche={() => {
                  setDesmocheMode((prev) => !prev);
                  setDesmocheSource(null);
                }}
                desmocheSource={desmocheSource}
                validDesmocheDestinationIds={validDesmocheDestinationIds}
                onPickDestination={handlePickDesmocheDestination}
              />
            )}
          </>
        )}
      </div>

      {state.phase === "cambio" && !state.isSpectator && (
        <CambioModal
          hand={state.yourHand}
          submitted={state.yourCambioSubmitted}
          seats={state.seats}
          submittedSeatIndices={state.cambio?.submittedSeatIndices ?? []}
          onSubmit={(card) => sendAction({ type: "submit-cambio-card", card })}
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

      {showTutorial && <TutorialModal onClose={handleCloseTutorial} />}

      {showGuestSummary && state && (
        <GuestSummaryModal
          summary={computeGuestSummary(state)}
          onCreateAccount={handleCreateAccountFromSummary}
          onLeaveAnyway={() => {
            setShowGuestSummary(false);
            leaveTable();
          }}
        />
      )}

      {dealAnim.flights.map((flight) => (
        <FlyingCard
          key={flight.id}
          from={flight.from}
          to={flight.to}
          delayMs={flight.delayMs}
          durationMs={dealAnim.flightDurationMs}
        />
      ))}

      {desmocheFlight && (
        <FlyingCard
          from={desmocheFlight.from}
          to={desmocheFlight.to}
          card={desmocheFlight.card}
          onDone={() => setDesmocheFlight(null)}
        />
      )}

      {stockFlip && (
        <StockFlipCard card={stockFlip.card} origin={stockFlip.origin} onDone={() => setStockFlip(null)} />
      )}
    </div>
  );
}
