import type { ClientGameState } from "@desmoche/shared";
import { useEscapeKey } from "../hooks/useEscapeKey";

interface ContextualHelpModalProps {
  state: ClientGameState;
  isYourTurn: boolean;
  canDraw: boolean;
  canAct: boolean;
  isClaimEligible: boolean;
  canClaim: boolean;
  turnPlayerName: string;
  onClose: () => void;
  onShowFullTutorial: () => void;
}

interface HelpContent {
  title: string;
  body: string;
}

/**
 * "¿Qué está pasando ahora mismo y qué puedo hacer?" — distinct from
 * TutorialModal (a fixed 5-slide walkthrough shown once, or reopened as a
 * full refresher): this reads the LIVE state and answers for the exact
 * moment the player is in, e.g. a claim window explains itself differently
 * depending on whether the offered card is actually claimable right now.
 */
function contextualHelp(props: ContextualHelpModalProps): HelpContent {
  const { state, isYourTurn, canDraw, canAct, isClaimEligible, canClaim, turnPlayerName } = props;

  if (state.isSpectator) {
    return {
      title: "Estás mirando esta mesa",
      body: "Sos espectador — ves todo lo que pasa, pero no participás. Las cartas de los jugadores quedan ocultas hasta que las bajen a un grupo.",
    };
  }

  if (state.phase === "lobby") {
    return {
      title: "Sala de espera",
      body: "Esperando a que todos marquen \"Estoy listo\". La mano arranca sola apenas estén todos listos (mínimo 2 jugadores).",
    };
  }

  if (state.phase === "cambio") {
    return {
      title: "Cambio",
      body: "Elegí 1 carta de tu mano para entregarla a ciegas al siguiente jugador en la rotación. Es simultáneo: nadie ve lo que recibió hasta que todos entregaron la suya.",
    };
  }

  if (state.phase === "claim-window") {
    if (!isClaimEligible) {
      return {
        title: "Ventana de reclamo",
        body: "Se ofreció una carta del bote y otro jugador ya la tiene prioridad, o no te toca decidir en esta ronda. Esperá — si nadie la reclama, el turno sigue su curso normal.",
      };
    }
    return canClaim
      ? {
          title: "¿Te sirve esta carta?",
          body: 'Esa carta del bote te sirve de inmediato en un grupo. Tocá "Sí me sirve" para reclamarla y jugar con ella ahora mismo, o "No me sirve" si preferís esperar tu turno normal.',
        }
      : {
          title: "¿Te sirve esta carta?",
          body: 'Solo podés reclamar una carta del bote si te sirve de inmediato en un grupo (nuevo o propio ya bajado) — y esta no te sirve ahora, por eso "Sí me sirve" está deshabilitado. Tocá "No me sirve" para pasar.',
        };
  }

  if (state.phase === "turn-active") {
    if (!isYourTurn) {
      return {
        title: "Turno de otro jugador",
        body: `Le toca a ${turnPlayerName}. Cuando termine, vas a poder robar del mazo en tu propio turno.`,
      };
    }
    if (canDraw) {
      return {
        title: "Es tu turno",
        body: 'Tocá el mazo (o el botón dorado "Robar del mazo") para robar una carta. Después vas a poder usarla en un grupo o botarla — no se puede elegir entre ella y el resto de tu mano.',
      };
    }
    if (canAct) {
      return {
        title: "Resolvé tu turno",
        body: 'Ya robaste (o reclamaste una carta). Ahora podés: bajar un grupo nuevo, agregar cartas a un grupo propio ya en mesa, desmochar (mover una carta entre tus grupos), o botar para terminar tu turno.',
      };
    }
  }

  if (state.phase === "hand-over") {
    return {
      title: "Mano terminada",
      body: 'Revisá el resultado en la ventana que se muestra. Tocá "Siguiente mano" cuando estés listo para seguir jugando.',
    };
  }

  return {
    title: "Desmoche",
    body: "Bajá tercias (3-4 cartas del mismo valor) o escaleras (3+ cartas seguidas del mismo palo) hasta que tu mano quede completa.",
  };
}

export default function ContextualHelpModal(props: ContextualHelpModalProps) {
  const { title, body } = contextualHelp(props);
  const { onClose, onShowFullTutorial } = props;
  useEscapeKey(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border-4 border-gold bg-felt p-6 shadow-2xl">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-stone-400">Ahora mismo</p>
        <h3 className="mb-2 font-display text-xl text-gold">{title}</h3>
        <p className="mb-4 text-sm text-stone-200">{body}</p>
        <button
          onClick={onShowFullTutorial}
          className="mb-2 w-full rounded-lg border border-stone-500 px-4 py-2 text-sm text-stone-200 transition hover:border-gold hover:text-gold"
        >
          Ver el tutorial completo
        </button>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-stone-900 transition hover:bg-gold-light"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
