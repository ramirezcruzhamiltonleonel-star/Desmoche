import { useEffect, useRef, useState } from "react";
import {
  canDesmocharAnyCardFrom,
  canClaimDiscard,
  computeGuestSummary,
  computeMeldProgress,
  explainClaimUsefulness,
  findPlayableCardIds,
  formatMeldCommentary,
  isAutoWinReason,
  isValidMeld,
  REACTION_EMOJIS,
  RETO_MAX_LENGTH,
  type Card as CardModel,
  type ClientSeatView,
} from "@desmoche/shared";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import { useTheme } from "../context/ThemeContext";
import { useDealAnimation } from "../hooks/useDealAnimation";
import { useSound } from "../hooks/useSound";
import { useReactions } from "../hooks/useReactions";
import { useVoiceChat } from "../hooks/useVoiceChat";
import { arrangeHandForDisplay } from "../lib/arrangeHand";
import { buildDealOrder } from "../lib/dealOrder";
import { cardKey } from "../lib/cardKey";
import { saveGuestNameHint } from "../lib/guestNameHint";
import { STAKE_LABELS } from "../lib/labels";
import { sortHandForDisplay } from "../lib/sortHand";
import { THEME_LABELS, THEMES } from "../lib/themeStorage";
import { hasFirstClaimHintBeenSeen, markFirstClaimHintSeen } from "../lib/claimHintStorage";
import { hasTutorialBeenSeen, markTutorialSeen } from "../lib/tutorialStorage";
import { vibrate } from "../lib/vibration";
import ActionBar from "./ActionBar";
import CambioModal from "./CambioModal";
import Card from "./Card";
import CardBack from "./CardBack";
import ChipStack from "./ChipStack";
import ChipToken from "./ChipToken";
import ClaimBanner from "./ClaimBanner";
import ContextualHelpModal from "./ContextualHelpModal";
import FlyingCard, { type Point } from "./FlyingCard";
import GuestSummaryModal from "./GuestSummaryModal";
import HandHistoryPanel from "./HandHistoryPanel";
import HandOverModal from "./HandOverModal";
import PlayerMeldsCluster from "./PlayerMeldsCluster";
import PlayerSeat from "./PlayerSeat";
import RulesPage from "./RulesPage";
import StockFlipCard from "./StockFlipCard";
import TutorialModal from "./TutorialModal";
import VoiceChatPanel from "./VoiceChatPanel";

interface CardFlight {
  from: Point;
  to: Point;
  card: CardModel;
}

interface StockFlip {
  card: CardModel;
  origin: Point;
}

type Slot = "top" | "left" | "right";

/**
 * Verified live (screenshot + turnSeatIndex trace) that the OLD mapping
 * (["left","top","right"] for offsets 1,2,3) rendered turns moving
 * CLOCKWISE on screen (bottom -> left -> top -> right -> bottom), the
 * opposite of turnOrder.ts's documented counter-clockwise convention. The
 * underlying seat-index rotation logic (nextSeat, closestInRotation) was
 * never wrong — only this screen-position assignment was inverted. Putting
 * the next-to-act seat (offset 1) on the RIGHT instead of the left flips
 * the visible rotation to bottom -> right -> top -> left -> bottom, which
 * is counter-clockwise.
 */
function seatSlots(count: number): Slot[] {
  if (count <= 1) return ["top"];
  if (count === 2) return ["right", "left"];
  return ["right", "top", "left"];
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
  const { state, sendAction, nextHand, leaveTable, requestJoinAsPlayer } = useGame();
  const { isGuest, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const sound = useSound();
  const voice = useVoiceChat();
  const { reactionsByPlayerId, sendReaction } = useReactions();
  const dealAnim = useDealAnimation();
  const [selectedCards, setSelectedCards] = useState<CardModel[]>([]);
  const [desmocheMode, setDesmocheMode] = useState(false);
  const [desmocheSource, setDesmocheSource] = useState<DesmocheSource | null>(null);
  const [cardFlight, setCardFlight] = useState<CardFlight | null>(null);
  const [stockFlip, setStockFlip] = useState<StockFlip | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showGuestSummary, setShowGuestSummary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !hasTutorialBeenSeen());
  const [showContextualHelp, setShowContextualHelp] = useState(false);
  const [handArranged, setHandArranged] = useState(false);
  const [confirmingRetire, setConfirmingRetire] = useState(false);
  const [drawingSeatIndex, setDrawingSeatIndex] = useState<number | null>(null);
  const [justSucceededMeldId, setJustSucceededMeldId] = useState<string | null>(null);
  const [botSpeech, setBotSpeech] = useState<{ seatIndex: number; text: string; key: number } | null>(null);
  const [firstClaimHint, setFirstClaimHint] = useState<string | null>(null);
  const [requestedToJoin, setRequestedToJoin] = useState(false);
  const [editingReto, setEditingReto] = useState(false);
  const [retoDraft, setRetoDraft] = useState("");
  const handCardsRef = useRef<HTMLDivElement>(null);
  const discardPileRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLDivElement>(null);
  const [chipFlights, setChipFlights] = useState<{ id: string; from: Point; to: Point; delayMs: number }[]>([]);
  const wonAlreadyRef = useRef(false);
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const prevIsYourTurnRef = useRef(false);
  const prevCardCountsRef = useRef<Record<number, number>>({});
  const prevOwnMeldSizesRef = useRef<Record<string, number>>({});
  const meldSizeInitRef = useRef(false);
  const prevEventLogLengthRef = useRef(0);
  const botSpeechKeyRef = useRef(0);

  useEffect(() => {
    if (state?.phase === "hand-over" && !wonAlreadyRef.current) {
      if (state.handOutcome && isAutoWinReason(state.handOutcome.reason)) {
        sound.playAutoWin();
      } else if (
        state.handOutcome &&
        (state.handOutcome.reason === "meld-out" || state.handOutcome.reason === "discard-out")
      ) {
        sound.playCloseWin();
      } else {
        sound.playWin();
      }
      // A bigger buzz specifically for the winner — same "cuts through a
      // distracted moment" reasoning as the turn-notification vibration,
      // but longer/distinct so it doesn't feel like just another turn.
      if (sound.enabled && state.handOutcome?.winnerSeatIndex === state.yourSeatIndex) {
        vibrate([120, 60, 120]);
      }
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
      // Ante collection, made visible: one chip per seat flies from that
      // seat's position to the pot, right as the new hand opens — same
      // "physical movement instead of a number just changing" idea as the
      // card deal, timed to land after the deal itself so it doesn't
      // compete for attention.
      if (state.stakeType !== "dare" && potRef.current) {
        const potPoint = (() => {
          const rect = potRef.current!.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })();
        const newChipFlights = state.seats
          .map((seat, i) => {
            // Your own seat isn't in the opponents' ring (it's rendered
            // separately below the felt) — same special case the deal
            // animation itself already makes for yourSeatIndex.
            const seatEl =
              seat.seatIndex === state.yourSeatIndex
                ? dealAnim.handTrayRef.current
                : (dealAnim.seatRefs.current.get(seat.seatIndex) ?? null);
            if (!seatEl) return null;
            const seatRect = seatEl.getBoundingClientRect();
            return {
              id: `chip-${Date.now()}-${seat.seatIndex}`,
              from: { x: seatRect.left + seatRect.width / 2, y: seatRect.top + seatRect.height / 2 },
              to: potPoint,
              delayMs: 900 + i * 80,
            };
          })
          .filter((f): f is { id: string; from: Point; to: Point; delayMs: number } => f !== null);
        if (newChipFlights.length > 0) {
          setChipFlights(newChipFlights);
          setTimeout(() => setChipFlights([]), 900 + newChipFlights.length * 80 + 500);
        }
      }
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

  useEffect(() => {
    // A meld the player owns growing (a new meld appearing, an extend, or a
    // desmoche landing a card on it) means their last action was confirmed
    // by the server — pulse that exact meld. Skip the very first run so a
    // page load / reconnect with existing melds already on the table doesn't
    // falsely celebrate.
    if (!state) return;
    const ownPlayerId = state.seats.find((s) => s.seatIndex === state.yourSeatIndex)?.playerId ?? null;
    const ownMelds = state.melds.filter((m) => m.ownerId === ownPlayerId);
    const prev = prevOwnMeldSizesRef.current;
    const isFirstRun = !meldSizeInitRef.current;
    meldSizeInitRef.current = true;
    const grownMeld = isFirstRun ? undefined : ownMelds.find((meld) => (prev[meld.id] ?? 0) < meld.cards.length);
    prevOwnMeldSizesRef.current = Object.fromEntries(ownMelds.map((m) => [m.id, m.cards.length]));
    if (grownMeld) {
      setJustSucceededMeldId(grownMeld.id);
      const timer = setTimeout(() => setJustSucceededMeldId(null), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.melds.map((m) => `${m.id}:${m.cards.length}`).join(",")]);

  useEffect(() => {
    // Bot commentary: only the newest entries since last render, and only
    // for a bot seat — a human's own meld/retire is already obvious from
    // their own screen, this is specifically to make bots feel alive.
    if (!state) return;
    const prevLength = prevEventLogLengthRef.current;
    const newEntries = state.eventLog.slice(prevLength);
    prevEventLogLengthRef.current = state.eventLog.length;
    if (prevLength === 0) return; // skip whatever already happened before this player joined/reconnected

    for (const entry of newEntries) {
      if (entry.type !== "meld-placed" && entry.type !== "retired") continue;
      const seat = state.seats.find((s) => s.seatIndex === entry.seatIndex);
      if (!seat || !seat.isBot) continue;
      const text =
        entry.type === "retired"
          ? `${seat.displayName} se retiró de la mano`
          : `${seat.displayName} bajó ${formatMeldCommentary(entry.meldType, entry.cards)}`;
      botSpeechKeyRef.current += 1;
      setBotSpeech({ seatIndex: entry.seatIndex, text, key: botSpeechKeyRef.current });
      const timer = setTimeout(() => setBotSpeech(null), 2300); // matches .reaction-float's 2.2s animation
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.eventLog.length]);

  useEffect(() => {
    // Only the very first genuinely-useful claim, ever, for this browser —
    // explains WHY once, then gets out of the way permanently. Keyed on
    // claimWindowId so this runs once per NEW window, not once per render.
    if (!state || state.phase !== "claim-window" || !state.claim) return;
    if (state.yourSeatIndex === null || !state.claim.pendingSeatIndices.includes(state.yourSeatIndex)) return;
    if (hasFirstClaimHintBeenSeen()) {
      // Already shown (maybe even earlier THIS window, before a re-render)
      // — never let a stale hint from an earlier window linger and
      // reappear on a later, unrelated claim.
      setFirstClaimHint(null);
      return;
    }
    const ownPlayerId = state.seats.find((s) => s.seatIndex === state.yourSeatIndex)?.playerId ?? null;
    const ownMelds = state.melds.filter((m) => m.ownerId === ownPlayerId);
    const hint = explainClaimUsefulness(state.yourHand, state.claim.card, ownMelds);
    if (hint) {
      setFirstClaimHint(hint);
      markFirstClaimHintSeen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.claim?.claimWindowId]);

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
  const meldProgress = computeMeldProgress(state.yourHand, myMelds);
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
    isClaimEligible && state.claim !== null && canClaimDiscard(state.yourHand, state.claim.card, myMelds);

  // A stock draw is never a free choice — whatever's selected must include it
  // before placing/extending is allowed to go through (mirrors the server's
  // assertPendingDrawnCardIncluded) — UNLESS the table's house rule allows
  // other melds first, in which case the server doesn't enforce this at all
  // and the UI shouldn't either. A claimed discard (mustPlaceCard) works the
  // pending-card way but doesn't force a specific selection beyond "place it",
  // and isn't affected by this house rule (it's about stock draws only).
  const requiredCard = state.allowMeldsBeforeResolvingDraw ? null : state.pendingDrawnCard;
  const selectionIncludesRequired =
    !requiredCard || selectedCards.some((c) => cardKey(c) === cardKey(requiredCard));
  const canPlaceMeld = selectionIncludesRequired && isValidMeld(selectedCards);
  const extendableMeldIds = new Set(
    selectedCards.length > 0 && selectionIncludesRequired
      ? myMelds.filter((meld) => isValidMeld([...meld.cards, ...selectedCards])).map((meld) => meld.id)
      : [],
  );
  // Every hand card that's part of AT LEAST ONE currently-legal move right
  // now (extends an own meld alone, or joins other hand cards into a
  // brand-new one) — used to highlight real options instead of leaving the
  // whole hand looking equally clickable until something gets rejected.
  // Only meaningful once it's actually your turn to act.
  const playableCardKeys = canAct
    ? findPlayableCardIds(state.yourHand, myMelds, requiredCard)
    : new Set<string>();
  // A quieter, gold cue distinct from playableCardKeys above (which is
  // green, and only ever populated during your own turn) — during a claim
  // window, this highlights which of YOUR hand cards would combine with
  // the offered discard if you claimed it, a passive hint for "is this
  // worth claiming" without reading any text.
  const claimConnectionKeys =
    isClaimEligible && state.claim
      ? findPlayableCardIds(state.yourHand, myMelds, state.claim.card)
      : new Set<string>();
  // Deliberately NOT gated on requiredCard/allowMeldsBeforeResolvingDraw —
  // the house rule only ever relaxes WHEN other melds can be placed, never
  // discard's own "must be exactly the pending card" rule, which the
  // server enforces unconditionally either way.
  const canDiscardSelection =
    selectedCards.length === 1 &&
    !state.mustPlaceCard &&
    (!state.pendingDrawnCard || cardKey(selectedCards[0]!) === cardKey(state.pendingDrawnCard));
  const canDesmoche = myMelds.some((meld) => canDesmocharAnyCardFrom(meld.cards));
  const validDesmocheDestinationIds = new Set(
    desmocheSource
      ? myMelds
          .filter((meld) => meld.id !== desmocheSource.meldId && isValidMeld([...meld.cards, desmocheSource.card]))
          .map((meld) => meld.id)
      : [],
  );
  // A desmoched card can ALSO be combined with the current hand selection
  // into a brand-new meld (rather than only moved into an existing one) —
  // this is what makes it possible to resolve a pending drawn/claimed card
  // via desmoche, since placeMeld's own selection-must-include-it rule
  // still applies. See table.ts placeMeld's `desmoche` parameter.
  const canPlaceMeldWithDesmoche = Boolean(
    desmocheSource &&
      selectionIncludesRequired &&
      isValidMeld([...selectedCards, desmocheSource.card]),
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

  function handlePlaceMeldWithDesmoche() {
    if (!desmocheSource) return;
    sendAction({
      type: "place-meld",
      cards: [...selectedCards, desmocheSource.card],
      desmoche: { fromMeldId: desmocheSource.meldId, card: desmocheSource.card },
    });
    setSelectedCards([]);
    setDesmocheMode(false);
    setDesmocheSource(null);
    sound.playMeld();
  }

  function handleExtend(meldId: string) {
    sendAction({ type: "extend-meld", meldId, cards: selectedCards });
    setSelectedCards([]);
    sound.playMeld();
  }

  function handleDiscard() {
    if (selectedCards.length !== 1) return;
    const card = selectedCards[0]!;
    const sourceEl = handCardsRef.current?.querySelector<HTMLElement>(`[data-card-key="${cardKey(card)}"]`);
    const destEl = discardPileRef.current;
    if (sourceEl && destEl) {
      const fromRect = sourceEl.getBoundingClientRect();
      const toRect = destEl.getBoundingClientRect();
      setCardFlight({
        from: { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
        to: { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 },
        card,
      });
    }
    sendAction({ type: "discard", card });
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

  function handleSaveReto() {
    const trimmed = retoDraft.trim();
    if (!trimmed) return;
    sendAction({ type: "set-reto", text: trimmed });
    setEditingReto(false);
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
    // cleanup) and routes back to <LoginScreen/> — logout() itself clears
    // the guest's session and any saved table code, so nothing else to
    // tear down first.
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
      setCardFlight({
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
      {/* relative z-[60] — above EVERY in-table modal (Cambio/hand-over at
          z-40, tutorial/history/guest-exit at z-50) — so Salir/Ayuda/
          Historial/Tema stay reachable no matter what's open. Safe even
          over the guest-exit summary: handleLeaveClick() just re-shows
          that same modal if it's already up, never bypasses it. Getting
          stuck unable to leave in time was a real, reported bug. */}
      <header className="relative z-[60] flex items-center justify-between px-3 py-2 text-xs text-stone-300">
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
          <button onClick={() => setShowContextualHelp(true)} aria-label="Ayuda — qué está pasando ahora" className="p-1 text-base">
            ❓
          </button>
          <button onClick={() => setShowRules(true)} aria-label="Reglas completas del juego" className="p-1 text-base">
            📖
          </button>
          <button onClick={() => setShowTutorial(true)} aria-label="Repasar el tutorial" className="p-1 text-base">
            🎓
          </button>
          <button onClick={() => setShowHistory(true)} aria-label="Historial de la mesa" className="p-1 text-base">
            📜
          </button>
          <button
            onClick={sound.toggle}
            aria-label="Sonido"
            aria-pressed={sound.enabled}
            className="p-1 text-base"
          >
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
            className="relative flex w-full min-w-0 flex-col items-center gap-1 justify-self-center"
          >
            {botSpeech?.seatIndex === seat.seatIndex && (
              <div
                key={botSpeech.key}
                className="reaction-float pointer-events-none absolute left-1/2 top-0 z-20 w-max max-w-[9rem] rounded-lg border border-gold/60 bg-stone-900/95 px-2 py-1 text-center text-[10px] leading-tight text-stone-100 shadow-lg"
              >
                {botSpeech.text}
              </div>
            )}
            <PlayerSeat
              seat={seat}
              isTurn={seat.seatIndex === state.turnSeatIndex}
              isDealer={seat.seatIndex === state.dealerSeatIndex}
              isSpeaking={voice.speakingPlayerIds.has(seat.playerId)}
              isDrawing={seat.seatIndex === drawingSeatIndex}
              reactionEmoji={reactionsByPlayerId[seat.playerId]?.emoji}
              reactionKey={reactionsByPlayerId[seat.playerId]?.key}
              chipsBalance={state.stakeType === "dare" ? null : seat.chipsBalance}
              foggy={state.isSpectator}
            />
            <PlayerMeldsCluster
              melds={state.melds.filter((m) => m.ownerId === seat.playerId)}
              size="sm"
              direction="row"
            />
          </div>
        ))}

        <div style={{ gridArea: "center" }} className="flex w-full min-w-0 flex-col items-center gap-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <div ref={dealAnim.deckRef} className="flex flex-col items-center gap-1">
              {canDraw ? (
                // The deck itself IS the action, not just a decoration next
                // to a separate "Robar del mazo" button — same handler,
                // same pending-draw-glow language already used elsewhere
                // for "this is the thing to do right now". Clicking it
                // triggers drawFromStock exactly like the ActionBar button;
                // the flip animation already reacts to pendingDrawnCard on
                // its own, so nothing extra is needed here for that part.
                <button
                  type="button"
                  onClick={handleDraw}
                  aria-label="Robar del mazo — es tu turno"
                  className="pending-draw-glow relative rounded-md ring-2 ring-gold transition hover:scale-105 active:scale-95"
                >
                  <CardBack size="md" />
                  <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-md bg-black/60 px-1 text-center leading-tight">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-gold">Tu turno</span>
                    <span className="text-[7.5px] text-gold-light">toca para robar</span>
                  </span>
                </button>
              ) : (
                <CardBack size="md" />
              )}
              <span className={`text-[10px] ${canDraw ? "font-semibold text-gold" : "text-stone-400"}`}>
                {canDraw ? "Mazo — toca para robar" : `Mazo (${state.stockCount})`}
              </span>
            </div>
            <div ref={discardPileRef} className="flex flex-col items-center gap-1">
              {state.topDiscard ? (
                // The top discard IS the card a claim window offers (initial
                // flip, every ritual reveal, and every normal in-hand
                // discard) — highlighting it here, not just inside
                // ClaimBanner's own copy, means every player/spectator sees
                // it glow, not only whoever's eligible to respond right now.
                <Card card={state.topDiscard} size="md" claimable={state.phase === "claim-window"} />
              ) : (
                <div className="h-20 w-14 rounded-md border-2 border-dashed border-stone-600" />
              )}
              <span className="text-[10px] text-stone-400">Descarte</span>
            </div>
            {state.stakeType !== "dare" && state.phase !== "lobby" && (
              <div ref={potRef} className="flex flex-col items-center gap-1">
                <ChipStack amount={state.ante * state.seats.length + state.accumulatedPot} size="sm" />
                <span className="text-[10px] text-stone-400">Pozo</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {state.phase === "claim-window" && state.claim && (
        <ClaimBanner
          // Remounts (resetting its countdown) on every distinct claim window,
          // including consecutive ritual reveals — claimWindowId is a fresh
          // server-assigned id per window, so this is exact (no reliance on
          // the card itself happening to differ).
          key={state.claim.claimWindowId}
          claim={state.claim}
          isEligible={isClaimEligible}
          canClaim={canClaim}
          firstClaimHint={firstClaimHint}
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
          <div className="py-3 text-center">
            <p className="mb-2 text-xs text-stone-400">
              👁 Modo espectador — estás mirando esta mesa sin participar.
            </p>
            {state.seats.length < 4 &&
              (requestedToJoin ? (
                <p className="text-xs text-gold">
                  Pediste unirte — entrás como jugador apenas empiece la próxima mano.
                </p>
              ) : (
                <button
                  onClick={() => {
                    requestJoinAsPlayer();
                    setRequestedToJoin(true);
                  }}
                  className="rounded-lg border border-gold px-4 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/10"
                >
                  Unirme como jugador en la próxima mano
                </button>
              ))}
          </div>
        ) : (
          <>
            {yourSeat && (
              <div className="mb-2 flex justify-center">
                <PlayerSeat
                  seat={yourSeat}
                  isTurn={isYourTurn && state.phase === "turn-active"}
                  isDealer={yourSeat.seatIndex === state.dealerSeatIndex}
                  isDrawing={yourSeat.seatIndex === drawingSeatIndex}
                  reactionEmoji={reactionsByPlayerId[yourSeat.playerId]?.emoji}
                  reactionKey={reactionsByPlayerId[yourSeat.playerId]?.key}
                  chipsBalance={state.stakeType === "dare" ? null : yourSeat.chipsBalance}
                  hideCardBacks
                />
              </div>
            )}
            {(state.phase === "turn-active" || state.phase === "claim-window") && (
              <div className="mb-2">
                <div className="mb-0.5 flex items-center justify-between text-[10px] text-stone-400">
                  <span>
                    {meldProgress.fraction >= 1
                      ? "¡Mano completa!"
                      : `${meldProgress.meldedCount} de ${meldProgress.totalCount} cartas en grupos`}
                  </span>
                  {meldProgress.fraction >= 0.8 && meldProgress.fraction < 1 && (
                    <span className="font-semibold text-gold">¡Ya casi ganás!</span>
                  )}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                  <div
                    className="h-full rounded-full bg-gold transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.round(Math.min(1, meldProgress.fraction) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {isYourTurn && state.phase === "turn-active" && (
              <p className="mb-2 animate-pulse text-center text-xs font-bold uppercase tracking-widest text-gold">
                ★ Tu turno ★
              </p>
            )}
            {state.stakeType === "dare" && !state.isSpectator && (
              <div className="mb-2 rounded-lg border border-wood/60 bg-stone-900/40 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-stone-400">
                  Tu reto — solo se revela a los demás si ganás una mano
                </p>
                {editingReto ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={retoDraft}
                      onChange={(e) => setRetoDraft(e.target.value)}
                      maxLength={RETO_MAX_LENGTH}
                      placeholder="Escribí tu reto..."
                      className="min-w-[10rem] flex-1 rounded-lg border border-wood-dark bg-stone-900 px-2 py-1 text-sm text-stone-100"
                    />
                    <button
                      onClick={handleSaveReto}
                      disabled={!retoDraft.trim()}
                      className="rounded-lg bg-gold px-3 py-1 text-xs font-semibold text-stone-900 transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingReto(false)}
                      className="rounded-lg border border-stone-500 px-3 py-1 text-xs text-stone-300 transition hover:border-stone-300"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-stone-200">
                      {state.yourReto ?? <span className="italic text-stone-500">Todavía no escribiste un reto</span>}
                    </p>
                    <button
                      onClick={() => {
                        setRetoDraft(state.yourReto ?? "");
                        setEditingReto(true);
                      }}
                      className="shrink-0 rounded-lg border border-stone-500 px-2 py-1 text-xs text-stone-300 transition hover:border-gold hover:text-gold"
                    >
                      {state.yourReto ? "Editar" : "Escribir"}
                    </button>
                  </div>
                )}
              </div>
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
                  pickable={(meld) => desmocheMode && !desmocheSource && canDesmocharAnyCardFrom(meld.cards)}
                  pickInProgress={desmocheMode && !desmocheSource}
                  onPickSourceCard={handlePickDesmocheSource}
                  sourceCardKey={desmocheSource ? cardKey(desmocheSource.card) : null}
                  highlightMeldId={justSucceededMeldId}
                />
              </div>
            )}
            <div ref={handCardsRef} className="mb-2 flex justify-center gap-2 overflow-x-auto pb-2">
              {(handArranged ? arrangeHandForDisplay(state.yourHand) : sortHandForDisplay(state.yourHand)).map(
                (card) => (
                  <div key={cardKey(card)} data-card-key={cardKey(card)}>
                    <Card
                      card={card}
                      selected={selectedCards.some((c) => cardKey(c) === cardKey(card))}
                      pendingDraw={Boolean(
                        state.pendingDrawnCard && cardKey(state.pendingDrawnCard) === cardKey(card),
                      )}
                      playable={playableCardKeys.has(cardKey(card))}
                      connectsToOffer={claimConnectionKeys.has(cardKey(card))}
                      onClick={() => toggleHandCard(card)}
                    />
                  </div>
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
                canPlaceMeldWithDesmoche={canPlaceMeldWithDesmoche}
                onPlaceMeldWithDesmoche={handlePlaceMeldWithDesmoche}
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
          onReact={state.isSpectator ? undefined : sendReaction}
        />
      )}

      {showHistory && (
        <HandHistoryPanel state={state} nameByPlayerId={nameByPlayerId} onClose={() => setShowHistory(false)} />
      )}

      {showRules && <RulesPage onClose={() => setShowRules(false)} />}

      {/* Deferred while Cambio's own modal needs the screen — a brand-new
          player's very first hand always opens on "cambio", so without this
          the two modals stacked on first load (reported bug). Still shows
          automatically the moment Cambio resolves; the ❓ button re-opens it
          any time regardless of phase. */}
      {showTutorial && state.phase !== "cambio" && <TutorialModal onClose={handleCloseTutorial} />}

      {showContextualHelp && (
        <ContextualHelpModal
          state={state}
          isYourTurn={isYourTurn}
          canDraw={canDraw}
          canAct={canAct}
          isClaimEligible={isClaimEligible}
          canClaim={canClaim}
          turnPlayerName={
            state.seats.find((s) => s.seatIndex === state.turnSeatIndex)?.displayName ?? "otro jugador"
          }
          onClose={() => setShowContextualHelp(false)}
          onShowFullTutorial={() => {
            setShowContextualHelp(false);
            setShowTutorial(true);
          }}
        />
      )}

      {showGuestSummary && state && (
        <GuestSummaryModal
          summary={computeGuestSummary(state)}
          onCreateAccount={handleCreateAccountFromSummary}
          onLeaveAnyway={() => {
            setShowGuestSummary(false);
            leaveTable();
          }}
          onCancel={() => setShowGuestSummary(false)}
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

      {cardFlight && (
        <FlyingCard
          from={cardFlight.from}
          to={cardFlight.to}
          card={cardFlight.card}
          onDone={() => setCardFlight(null)}
        />
      )}

      {stockFlip && (
        <StockFlipCard card={stockFlip.card} origin={stockFlip.origin} onDone={() => setStockFlip(null)} />
      )}

      {chipFlights.map((flight) => (
        <FlyingCard key={flight.id} from={flight.from} to={flight.to} delayMs={flight.delayMs} durationMs={380}>
          <ChipToken size="sm" />
        </FlyingCard>
      ))}
    </div>
  );
}
