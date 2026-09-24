export const RETO_MAX_LENGTH = 140;

/**
 * A deliberately basic, conservative offensive-content filter for free-text
 * retos — a flat list of common Spanish-language profanity/slurs, matched
 * as case-insensitive, accent-insensitive substrings. This is NOT meant to
 * be exhaustive or clever about evasion (leetspeak, spacing tricks); it's a
 * first line of defense against the obvious cases, matching what was asked
 * for ("un filtro básico de contenido ofensivo").
 */
const BANNED_SUBSTRINGS = [
  "puta",
  "puto",
  "mierda",
  "pendejo",
  "pendeja",
  "cabron",
  "gilipollas",
  "idiota",
  "imbecil",
  "estupido",
  "estupida",
  "maricon",
  "marica",
  "hijueputa",
  "hijodeputa",
  "verga",
  "chingada",
  "chingado",
  "cerote",
  "malparido",
  "malparida",
  "zorra",
  "perra",
  "culero",
  "culera",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip combining accents so "cabrón"/"cabron" both match
}

export function containsOffensiveContent(text: string): boolean {
  const normalized = normalize(text);
  return BANNED_SUBSTRINGS.some((word) => normalized.includes(word));
}
