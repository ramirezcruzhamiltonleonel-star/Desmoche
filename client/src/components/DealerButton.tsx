/** The classic casino "dealer button" puck — a small cream disc with a bold D, gold ring. Purely a visual marker (dealing itself is automatic server-side); rotates seat to seat every hand the same way state.dealerSeatIndex already does. */
export default function DealerButton() {
  return (
    <div
      className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-gold bg-stone-50 font-display text-[10px] font-bold text-stone-900 shadow-md"
      aria-label="Reparte esta mano"
      title="Reparte esta mano"
    >
      D
    </div>
  );
}
