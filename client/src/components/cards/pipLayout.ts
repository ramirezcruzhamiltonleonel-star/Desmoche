/**
 * Standard pip placement for number cards (2-10), as percentage coordinates
 * within the card's face area. `rotated` flips that pip 180° — the bottom
 * half of a real card is always upside-down relative to the top half, same
 * as a physical deck. Reused across all 4 suits (only the glyph/color
 * changes) and across all sizes (pure percentages).
 */
export interface PipPosition {
  x: number;
  y: number;
  rotated?: boolean;
}

// Kept well clear of the corner index (rank + suit glyph in each corner) so
// a two-digit "10" or the pip nearest a corner never overlaps the numeral —
// a reported legibility bug. Margins are noticeably wider than a physical
// card's because our smallest render sizes are only ~30-40px tall, where a
// legible corner index needs proportionally more breathing room.
const L = 27;
const C = 50;
const R = 73;
const TOP = 20;
const UPPER = 33;
const UPMID = 41;
const MID = 50;
const LOWMID = 59;
const LOWER = 67;
const BOTTOM = 85;

export const PIP_LAYOUTS: Record<number, PipPosition[]> = {
  2: [
    { x: C, y: TOP },
    { x: C, y: BOTTOM, rotated: true },
  ],
  3: [
    { x: C, y: TOP },
    { x: C, y: MID },
    { x: C, y: BOTTOM, rotated: true },
  ],
  4: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
  5: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: C, y: MID },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
  6: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: L, y: MID },
    { x: R, y: MID },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
  7: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: C, y: UPPER },
    { x: L, y: MID },
    { x: R, y: MID },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
  8: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: C, y: UPPER },
    { x: L, y: MID },
    { x: R, y: MID },
    { x: C, y: LOWER, rotated: true },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
  9: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: L, y: UPMID },
    { x: R, y: UPMID },
    { x: C, y: MID },
    { x: L, y: LOWMID, rotated: true },
    { x: R, y: LOWMID, rotated: true },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
  10: [
    { x: L, y: TOP },
    { x: R, y: TOP },
    { x: C, y: UPPER },
    { x: L, y: UPMID },
    { x: R, y: UPMID },
    { x: L, y: LOWMID, rotated: true },
    { x: R, y: LOWMID, rotated: true },
    { x: C, y: LOWER, rotated: true },
    { x: L, y: BOTTOM, rotated: true },
    { x: R, y: BOTTOM, rotated: true },
  ],
};
