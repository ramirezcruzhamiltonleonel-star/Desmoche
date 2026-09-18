const CODE_PARAM = "mesa";

/** Direct join link for a table — opening it pre-fills and switches HomeScreen to the "join" tab. */
export function buildJoinLink(code: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set(CODE_PARAM, code);
  return url.toString();
}

/** Reads a `?mesa=CODE` from the current URL, if present (e.g. someone opened a shared join link). */
export function readJoinCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get(CODE_PARAM);
  return code ? code.toUpperCase() : null;
}
