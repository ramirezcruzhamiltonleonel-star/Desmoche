const COLORS = ["#d4af37", "#e8c766", "#ffffff", "#4ade80", "#f87171"];
const PIECES = 36;

/**
 * Purely decorative, self-cleaning (CSS animation `forwards` + fixed
 * duration) — no library, just a burst of absolutely-positioned divs
 * falling/rotating from the top. Meant to be mounted once per celebration
 * and left alone; the parent unmounts it (or it just sits inert) once the
 * animation finishes.
 */
export default function Confetti() {
  const pieces = Array.from({ length: PIECES }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const duration = 1.6 + Math.random() * 0.9;
    const color = COLORS[i % COLORS.length];
    const rotateStart = Math.random() * 360;
    const drift = (Math.random() - 0.5) * 120;
    return { id: i, left, delay, duration, color, rotateStart, drift };
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-[-5%] h-2.5 w-1.5"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // @ts-expect-error -- custom properties read by the keyframe
            "--rotate-start": `${p.rotateStart}deg`,
            "--drift": `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
