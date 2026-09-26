/**
 * Custom gold-line icons replacing the header's emoji row (❓📖🎓📜🔊/🔇) — a
 * reported "generic web app" cue, since emoji render differently (and
 * sometimes as an ugly fallback glyph) across every OS/browser instead of
 * looking like a deliberate part of this table's own visual design.
 * Deliberately simple, single-stroke line art at a fixed 18x18 viewBox so
 * they all sit at the same visual weight in the header row.
 */
import type { ReactNode } from "react";

const STROKE = "currentColor";

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" fill="none" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function HelpIcon() {
  return (
    <IconBase>
      <circle cx="9" cy="9" r="7.3" />
      <path d="M6.7 6.8c0-1.4 1.1-2.3 2.4-2.3s2.3.8 2.3 2c0 1.6-2.1 1.7-2.1 3.4" />
      <circle cx="9" cy="13" r="0.15" fill={STROKE} stroke="none" />
    </IconBase>
  );
}

export function RulesIcon() {
  return (
    <IconBase>
      <path d="M3.5 4.2c1.6-.6 3.6-.5 5.5.6 1.9-1.1 3.9-1.2 5.5-.6v9.6c-1.6-.6-3.6-.5-5.5.6-1.9-1.1-3.9-1.2-5.5-.6Z" />
      <path d="M9 4.8v9.6" />
    </IconBase>
  );
}

export function TutorialIcon() {
  return (
    <IconBase>
      <path d="M1.8 6.2 9 3l7.2 3.2L9 9.4Z" />
      <path d="M4.8 7.7v3.4c0 1 1.9 1.9 4.2 1.9s4.2-.9 4.2-1.9V7.7" />
      <path d="M16.2 6.2v4" />
    </IconBase>
  );
}

export function HistoryIcon() {
  return (
    <IconBase>
      <path d="M4 5.5a6 6 0 1 1-1.4 4" />
      <path d="M2 3.6v2.5h2.5" />
      <path d="M9 5.8v3.4l2.5 1.5" />
    </IconBase>
  );
}

export function SoundOnIcon() {
  return (
    <IconBase>
      <path d="M3 7.2h2.6L9.2 4v10L5.6 10.8H3Z" />
      <path d="M12 6.6c1 .8 1 4 0 4.8" />
      <path d="M13.9 4.9c2 1.7 2 6.5 0 8.2" />
    </IconBase>
  );
}

export function SoundOffIcon() {
  return (
    <IconBase>
      <path d="M3 7.2h2.6L9.2 4v10L5.6 10.8H3Z" />
      <path d="M12.2 7.2l4 3.6" />
      <path d="M16.2 7.2l-4 3.6" />
    </IconBase>
  );
}
