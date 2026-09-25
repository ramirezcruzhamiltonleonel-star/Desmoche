import { useEffect, useRef, useState } from "react";

export interface CustomSelectOption<T extends string> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Extra classes for the trigger button (font size, width, etc.) — the dropdown panel always uses the felt/gold styling regardless. */
  triggerClassName?: string;
  disabledValues?: T[];
}

/**
 * A dropdown styled entirely in the felt/gold palette — a native <select>'s
 * own open menu is drawn by the OS/browser and can't be restyled with CSS
 * at all, which is exactly the "generic browser UI" this replaces. Closes
 * on an outside click, Escape, or picking an option.
 */
export default function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  triggerClassName = "",
  disabledValues = [],
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded border border-wood-dark bg-felt-dark px-2 py-1 text-stone-200 transition hover:border-gold ${triggerClassName}`}
      >
        <span className="truncate">{current?.label ?? ""}</span>
        <span aria-hidden className={`text-[9px] text-gold transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-1 max-w-[min(90vw,20rem)] min-w-full overflow-hidden rounded-lg border border-gold/50 bg-felt-dark shadow-xl"
        >
          {options.map((option) => {
            const disabled = disabledValues.includes(option.value);
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left transition ${
                    option.value === value ? "bg-gold/20 text-gold" : "text-stone-200 hover:bg-gold/10"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
