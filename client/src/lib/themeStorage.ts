export const THEMES = ["clasico", "noche", "cantina"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  clasico: "Clásico",
  noche: "Noche",
  cantina: "Cantina",
};

const STORAGE_KEY = "desmoche.theme";

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (THEMES as readonly string[]).includes(saved ?? "") ? (saved as Theme) : "clasico";
  } catch {
    return "clasico";
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}
