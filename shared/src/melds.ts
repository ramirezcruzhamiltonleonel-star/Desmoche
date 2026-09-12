import type { Card } from "./cards";

export type MeldType = "set" | "run";

export interface Meld {
  id: string;
  type: MeldType;
  ownerId: string;
  cards: Card[];
}

export type StakeType = "chips" | "money" | "dare";
