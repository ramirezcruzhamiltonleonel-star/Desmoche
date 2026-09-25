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
  "discard-out": "Ganó botando",
  "stock-exhausted": "Se acabó el mazo — nadie ganó",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  "claimed-discard": "Robó del bote",
  desmocho: "Desmoche",
  peladia: "Peladía",
  "cuatro-cuerpos": "Cuatro Cuerpos",
  "auto-extend": "Se le agregó a su grupo",
  "meld-placed": "Bajó un grupo",
  retired: "Se retiró de la mano",
};
