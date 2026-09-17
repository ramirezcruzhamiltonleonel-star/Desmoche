import type { StakeType } from "@desmoche/shared";

export const STAKE_LABELS: Record<StakeType, string> = {
  chips: "Fichas",
  dare: "Retos",
  money: "Dinero real (próximamente)",
};

export const REASON_LABELS: Record<string, string> = {
  peladia: "¡Peladía!",
  "cuatro-cuerpos": "¡Cuatro Cuerpos!",
  "meld-out": "Ganó bajando toda la mano",
  "discard-out": "Ganó por descarte",
  "stock-exhausted": "Se acabó el mazo — nadie ganó",
};
