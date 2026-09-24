export type ChipDenomination = "bronze" | "silver" | "gold";

const DENOMINATION_COLORS: Record<ChipDenomination, { face: string; edge: string; notch: string }> = {
  bronze: { face: "#8a5a2b", edge: "#5e3a19", notch: "#c98d4f" },
  silver: { face: "#9aa4ad", edge: "#5f6a73", notch: "#e2e9ee" },
  gold: { face: "#d4af37", edge: "#8a6a1e", notch: "#f4dd8a" },
};

const SIZE_PX = { sm: 18, md: 26, lg: 34 } as const;

/** One casino poker chip — a plain filled disc, a darker edge ring, and evenly-spaced notches around the rim (the classic "striped edge" read at a glance, cheap to draw as pure geometry). */
export default function ChipToken({
  denomination = "gold",
  size = "md",
}: {
  denomination?: ChipDenomination;
  size?: keyof typeof SIZE_PX;
}) {
  const colors = DENOMINATION_COLORS[denomination];
  const px = SIZE_PX[size];
  const notchCount = 8;

  return (
    <svg viewBox="0 0 40 40" width={px} height={px} className="drop-shadow-md">
      <circle cx="20" cy="20" r="19" fill={colors.edge} />
      <circle cx="20" cy="20" r="15.5" fill={colors.face} />
      {Array.from({ length: notchCount }).map((_, i) => {
        const angle = (i / notchCount) * Math.PI * 2;
        const x1 = 20 + Math.cos(angle) * 19;
        const y1 = 20 + Math.sin(angle) * 19;
        const x2 = 20 + Math.cos(angle) * 15.5;
        const y2 = 20 + Math.sin(angle) * 15.5;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.notch} strokeWidth="2.4" />;
      })}
      <circle cx="20" cy="20" r="9.5" fill="none" stroke={colors.notch} strokeWidth="1.2" opacity="0.8" />
    </svg>
  );
}
