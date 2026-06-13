/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#15803d", // 森: グリーン
        canopy: "#166534", // 樹冠
        sky: "#0ea5e9", // 空アクセント
        clay: "#f59e0b", // 暖色アクセント
      },
    },
  },
  plugins: [],
};
