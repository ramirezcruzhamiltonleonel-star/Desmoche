/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0b3d2e",
          dark: "#082c21",
        },
        wood: {
          DEFAULT: "#5b3a29",
          dark: "#3d2818",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f0d878",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
      },
    },
  },
  plugins: [],
};
