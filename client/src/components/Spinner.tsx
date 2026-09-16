const SIZE_CLASSES = {
  sm: "h-3.5 w-3.5 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

const TONE_CLASSES = {
  /** For dark backgrounds (felt panels) — gold accent. */
  gold: "border-gold/30 border-t-gold",
  /** For light/gold backgrounds (solid gold buttons) — dark accent instead, so it stays visible. */
  dark: "border-stone-900/30 border-t-stone-900",
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}

/** Small inline spinner matching the felt/gold theme everywhere else. */
export default function Spinner({ size = "sm", tone = "gold" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block animate-spin rounded-full ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]}`}
    />
  );
}
