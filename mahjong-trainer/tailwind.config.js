/** @type {import('tailwindcss').Config} */
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
  plugins: [],
};
