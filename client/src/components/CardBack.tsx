const SIZE_CLASSES = {
  sm: "h-14 w-10",
  md: "h-20 w-14",
  lg: "h-24 w-16",
} as const;

const GOLD = "#d4af37";
const FELT = "#0b3d2e";
const FELT_DARK = "#082c21";

/** Official Desmoche card back — dark felt, gold frame, corner flourishes, suit ovals, wordmark. */
export default function CardBack({ size = "sm" }: { size?: keyof typeof SIZE_CLASSES }) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-md shadow-md ${SIZE_CLASSES[size]}`}>
      <svg viewBox="0 0 100 140" className="h-full w-full" role="img" aria-label="Reverso de carta Desmoche">
        <defs>
          <linearGradient id="db-felt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={FELT} />
            <stop offset="100%" stopColor={FELT_DARK} />
          </linearGradient>
        </defs>

        <rect x="2" y="2" width="96" height="136" rx="7" fill="url(#db-felt)" stroke={GOLD} strokeWidth="3" />
        <rect
          x="6.5"
          y="6.5"
          width="87"
          height="127"
          rx="4"
          fill="none"
          stroke={GOLD}
          strokeWidth="0.8"
          opacity="0.85"
        />

        {/* Corner flourishes */}
        {[
          [11, 11],
          [89, 11],
          [11, 129],
          [89, 129],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`} stroke={GOLD} strokeWidth="0.8" fill="none">
            <path d="M -5 0 L 0 -5 L 5 0 L 0 5 Z" />
            <circle r="1.3" fill={GOLD} />
          </g>
        ))}

        {/* Top suit oval */}
        <ellipse cx="50" cy="26" rx="24" ry="11" fill="none" stroke={GOLD} strokeWidth="0.9" />
        <text x="50" y="30" textAnchor="middle" fontSize="11" fill={GOLD} letterSpacing="2">
          ♠ ♥ ♦ ♣
        </text>

        {/* Bottom suit oval (mirrored) */}
        <g transform="rotate(180 50 70)">
          <ellipse cx="50" cy="26" rx="24" ry="11" fill="none" stroke={GOLD} strokeWidth="0.9" />
          <text x="50" y="30" textAnchor="middle" fontSize="11" fill={GOLD} letterSpacing="2">
            ♠ ♥ ♦ ♣
          </text>
        </g>

        {/* Center divider lines */}
        <line x1="16" y1="47" x2="84" y2="47" stroke={GOLD} strokeWidth="0.6" opacity="0.6" />
        <line x1="16" y1="93" x2="84" y2="93" stroke={GOLD} strokeWidth="0.6" opacity="0.6" />

        {/* Wordmark */}
        <text
          x="50"
          y="66"
          textAnchor="middle"
          fontFamily="'Playfair Display', serif"
          fontWeight="700"
          fontSize="13"
          fill={GOLD}
          letterSpacing="1"
        >
          DES
        </text>
        <text
          x="50"
          y="80"
          textAnchor="middle"
          fontFamily="'Playfair Display', serif"
          fontWeight="700"
          fontSize="13"
          fill={GOLD}
          letterSpacing="1"
        >
          MOCHE
        </text>
      </svg>
    </div>
  );
}
