import ChipToken, { type ChipDenomination } from "./ChipToken";

function denominationFor(amount: number): ChipDenomination {
  if (amount >= 400) return "gold";
  if (amount >= 150) return "silver";
  return "bronze";
}

/** Purely visual: how many chips to stack for a given pot size — grows with the amount but caps out (a literal chip-per-unit count would get absurd for a big accumulated pot), same idea a real felt uses higher-denomination chips instead of an ever-taller pile. */
function chipCountFor(amount: number): number {
  if (amount <= 0) return 0;
  return Math.min(8, Math.max(1, Math.ceil(amount / 100)));
}

/**
 * The pot, represented as an actual stack of casino chips instead of only a
 * number — denomination color escalates with the pot size (bronze, then
 * silver, then gold), and the stack visibly grows taller as the pot does.
 */
export default function ChipStack({ amount, size = "md" }: { amount: number; size?: "sm" | "md" }) {
  const count = chipCountFor(amount);
  const denomination = denominationFor(amount);

  if (count === 0) return null;

  const overlapPx = size === "sm" ? 5 : 7;

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col-reverse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ marginTop: i === 0 ? 0 : -overlapPx }}>
            <ChipToken denomination={denomination} size={size} />
          </div>
        ))}
      </div>
      <span className="mt-1 text-[10px] font-semibold tabular-nums text-gold">{amount}</span>
    </div>
  );
}
