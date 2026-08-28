/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sea: "#0e7490", // 海: ティール
        deep: "#155e75", // 深場
        sand: "#fcd34d", // 砂浜アクセント
      },
    },
  },
  plugins: [],
};
