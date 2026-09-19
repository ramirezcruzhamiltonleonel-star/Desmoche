import { randomUUID } from "node:crypto";

/**
 * Guest sessions are never written to the `User` table — no signup, no
 * persistence, gone the moment they close the tab. The "guest:" prefix is
 * the only thing that marks a playerId as a guest anywhere in the server,
 * same pattern as `isBotPlayerId`. The one place that actually has to know
 * about it is persistence (see persistence/handHistory.ts): a guest seat
 * can't be written to HandHistoryPlayer, which has a hard foreign key to a
 * real User row.
 */
export function createGuestPlayerId(): string {
  return `guest:${randomUUID()}`;
}

export function isGuestPlayerId(playerId: string): boolean {
  return playerId.startsWith("guest:");
}
