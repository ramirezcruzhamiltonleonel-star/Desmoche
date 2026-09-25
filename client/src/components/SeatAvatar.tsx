/**
 * A bot shows its persona emoji; a real player gets a plain initials badge
 * (first letter of their display name) in the same size/shape, so every
 * seat always has SOME avatar — never blank, never a generic 🤖 for bots
 * (each persona is a distinct character, per BOT_PERSONAS).
 */
export default function SeatAvatar({ avatar, displayName }: { avatar: string | null; displayName: string }) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-stone-900/70 text-sm leading-none">
      {avatar ?? <span className="font-display font-bold text-gold">{initial}</span>}
    </div>
  );
}
