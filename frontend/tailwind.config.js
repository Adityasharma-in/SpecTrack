/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        cyber: {
          black: "#0a0a10",
          darker: "#050508",
          card: "rgba(255,255,255,0.03)",
          border: "rgba(0,229,255,0.15)",
          cyan: "#00e5ff",
          magenta: "#ff0066",
          amber: "#ffb800",
          emerald: "#00ff88",
          red: "#ff3366",
          text: "#e8e8ed",
          muted: "#8888a0",
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "scan-line": "scan-line 8s linear infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,229,255,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0,229,255,0.6)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      backgroundImage: {
        grid: `
          linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};
