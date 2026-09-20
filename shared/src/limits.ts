/**
 * A guest display name with no length limit rendered fine as text but broke
 * the header layout at ~70 characters (reported live) — enforced both in
 * the input's maxLength (UX) and here server-side (a non-browser client
 * could otherwise send anything). Applies to both guest and real-account
 * display names, since the header renders either one identically.
 */
export const DISPLAY_NAME_MAX_LENGTH = 24;
