/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "table-green": "#2d6a4f",
        "tile-bg": "#f5f0e8",
        "tile-border": "#8b7355",
        "honor-red": "#dc2626",
        "honor-green": "#16a34a",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("landscape", "@media (orientation: landscape)");
      addVariant("portrait", "@media (orientation: portrait)");
    }),
  ],
};
