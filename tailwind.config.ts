import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#05071a",
        "primary-light": "#0a0e2a",
        accent: "#3a6ef2",
        "accent-hover": "#2b5cd4",
        teal: "#47cc88",
        "border-subtle": "#1c244c",
        "text-secondary": "#9ea3bf",
        "card-bg": "#0d1025",
        "card-border": "#1a1f3d",
      },
      fontFamily: {
        sora: ["Sora", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
export default config;
