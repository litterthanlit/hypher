import type { Config } from "tailwindcss";

export default {
  prefix: "tw-",
  corePlugins: {
    preflight: false,
  },
  content: [
    "./src/app/page.tsx",
    "./src/app/pricing/page.tsx",
    "./src/components/marketing/**/*.{ts,tsx}",
    "./src/app/beta/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        electric: {
          DEFAULT: "var(--accent)",
          dim: "var(--accent-hover)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        /** Michroma — marketing headlines + wordmark */
        wordmark: ["var(--font-wordmark)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
