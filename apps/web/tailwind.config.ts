import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#071a33",
        "navy-2": "#0c2748",
        ink: "#10233d",
        muted: "#65738a",
        paper: "#f6f7f4",
        blue: "#2667e8",
        "blue-soft": "#dce8ff",
        teal: "#22a89a",
        "teal-soft": "#daf1eb",
        coral: "#ff715d",
        "coral-soft": "#ffe2dc",
        lime: "#d9f06b",
      },
      fontFamily: {
        sans: [
          "Noto Sans KR",
          "Malgun Gothic",
          "Apple SD Gothic Neo",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 24px 70px rgba(10, 29, 51, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
