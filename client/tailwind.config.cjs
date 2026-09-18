/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sourced from CSS variables (see src/styles/index.css) so a
        // data-theme attribute on <html> can swap every one of these at
        // once — "clásico", "noche", "cantina" — without touching any
        // component's className. Each variable holds an "R G B" triplet
        // (not a hex string) so Tailwind's opacity modifiers (bg-gold/20,
        // border-wood/60, etc.) keep working exactly as before.
        felt: {
          DEFAULT: "rgb(var(--color-felt) / <alpha-value>)",
          dark: "rgb(var(--color-felt-dark) / <alpha-value>)",
        },
        wood: {
          DEFAULT: "rgb(var(--color-wood) / <alpha-value>)",
          dark: "rgb(var(--color-wood-dark) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--color-gold) / <alpha-value>)",
          light: "rgb(var(--color-gold-light) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
      },
    },
  },
  plugins: [],
};
