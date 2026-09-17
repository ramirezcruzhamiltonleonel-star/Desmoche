import type { ClientClaimView } from "@desmoche/shared";
import Card from "./Card";

interface ClaimBannerProps {
  claim: ClientClaimView;
  isEligible: boolean;
  onRespond: (response: "claim" | "pass") => void;
}

export default function ClaimBanner({ claim, isEligible, onRespond }: ClaimBannerProps) {
  return (
    <div className="mx-3 mb-3 rounded-xl border-2 border-gold bg-stone-900/90 p-3">
      <div className="mb-2 flex items-center justify-center gap-3">
        <span className="text-sm text-stone-200">¿Alguien quiere esta carta?</span>
        <Card card={claim.card} size="sm" />
      </div>
      {isEligible ? (
        <div className="flex justify-center gap-3">
          <button
            onClick={() => onRespond("claim")}
            className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-stone-900 transition hover:bg-gold-light"
          >
            Sí me sirve
          </button>
          <button
            onClick={() => onRespond("pass")}
            className="rounded-lg border border-stone-500 px-4 py-1.5 text-sm text-stone-200 transition hover:border-stone-300"
          >
            No me sirve
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-stone-400">Esperando a los demás jugadores...</p>
      )}
    </div>
  );
}
