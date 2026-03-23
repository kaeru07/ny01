/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 牌スーツカラー
        man:   "#dc2626", // 万子: 赤
        pin:   "#2563eb", // 筒子: 青
        sou:   "#16a34a", // 索子: 緑
        honor: "#7c3aed", // 字牌: 紫
      },
    },
  },
  plugins: [],
};
