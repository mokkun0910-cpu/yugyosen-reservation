import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  "#f0f4f7",
          100: "#d9e4ec",
          200: "#b3c9d9",
          500: "#3a6a8a",
          600: "#2a5070",
          700: "#1a3a4a",
          800: "#112535",
          900: "#0a1820",
        },
        gold: {
          50:  "#fdf8ec",
          100: "#f9edcc",
          400: "#d4b84a",
          500: "#c5a028",
          600: "#a8891f",
        },
        cream: {
          50:  "#faf8f4",
          100: "#f3ede2",
        },
      },
      fontFamily: {
        serif: ["'Noto Serif JP'", "Yu Mincho", "游明朝", "serif"],
        sans:  ["'Noto Sans JP'", "Hiragino Kaku Gothic ProN", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
