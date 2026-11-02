import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Les couleurs des portefeuilles (dégradés) sont écrites dans src/lib : sans ce dossier, elles ne sont pas générées.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/context/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kpakpato: {
          orange: "#FF7900",
          green: "#009E60",
          dark: "#0F172A",
          gold: "#F59E0B",
        },
        wallet: {
          wave: "#1DC4FF",
          orange: "#FF7900",
          mtn: "#FFCC00",
          moov: "#0055A5",
          djamo: "#111827",
          cash: "#10B981",
        },
      },
    },
  },
  plugins: [],
};
export default config;
