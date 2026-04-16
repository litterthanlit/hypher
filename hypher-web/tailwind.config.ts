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
  ],
  theme: {
    extend: {
      colors: {
        electric: {
          DEFAULT: "#2563eb",
          dim: "#1d4ed8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
