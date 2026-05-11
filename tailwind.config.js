/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e9ff",
          200: "#bad8ff",
          500: "#2e7cf6",
          600: "#1e66dc",
          700: "#1b54b3",
        },
      },
      boxShadow: {
        soft: "0 8px 24px rgba(15, 56, 120, 0.08)",
        lift: "0 12px 32px rgba(15, 56, 120, 0.12)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        tooltipIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in-up-fast": "fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scaleIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "tooltip-in": "tooltipIn 0.18s ease-out both",
        shake: "shake 0.45s ease-in-out both",
      },
    },
  },
  plugins: [],
};
