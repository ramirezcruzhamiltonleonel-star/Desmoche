export type BonusKind = "peladia" | "cuatro-cuerpos" | "mico" | "patona" | "oro" | "corazon" | "flor";

const KEY_PREFIX = "desmoche.bonusSeen.";

/**
 * "Seen this session" — sessionStorage (this tab, gone on close), matching
 * the explicit "después de esa primera vez EN LA SESIÓN" ask: a returning
 * visit (or a guest session, which never touches localStorage anyway)
 * should see the full explanation again, but switching tables within the
 * same tab shouldn't re-explain something already understood.
 */
export function hasSeenBonus(kind: BonusKind): boolean {
  try {
    return sessionStorage.getItem(KEY_PREFIX + kind) === "1";
  } catch {
    return false;
  }
}

export function markBonusSeen(kind: BonusKind): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + kind, "1");
  } catch {
    // ignore
  }
}
