/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Warm paper: white surfaces on a warm off-white ground, a calm blue as the one main
      // colour, warm greys for text and rules. Status colours are muted to sit with the paper.
      colors: {
        brand: {
          50: "#f1f4fc",
          100: "#e2e8f8",
          200: "#c5d1f0",
          300: "#9db0e3",
          400: "#7189d3",
          500: "#4f69c2",
          600: "#3f57a8",
          700: "#33488c",
          800: "#26365f",
          900: "#1a2541",
        },
        ink: {
          DEFAULT: "#2b2924",
          soft: "#4a463f",
          muted: "#6f6a60",
        },
        // The neutral and status scales are remapped onto the paper palette, so the existing
        // slate-* / emerald-* / amber-* / rose-* classes across the app follow it: slate is a
        // warm grey, the status hues are muted. Text shades (500+) keep >= 4.5:1 on white and paper.
        slate: {
          50: "#faf9f6",
          100: "#f3f1ec",
          200: "#e8e3d8",
          300: "#d9d3c6",
          400: "#a8a196",
          500: "#736d63",
          600: "#5e5950",
          700: "#4a463f",
          800: "#36332d",
          900: "#2b2924",
          950: "#1c1a17",
        },
        emerald: {
          50: "#f1f6f2",
          100: "#e0ebe3",
          200: "#c3d8c9",
          300: "#9dbfa6",
          400: "#74a181",
          500: "#5a8a68",
          600: "#4a7456",
          700: "#3d6148",
          800: "#324f3b",
          900: "#283f2f",
          950: "#1d2e22",
        },
        amber: {
          50: "#faf5ea",
          100: "#f3e8cf",
          200: "#e8d5a8",
          300: "#d9bc7c",
          400: "#c8a259",
          500: "#b0873a",
          600: "#8c6a22",
          700: "#74581d",
          800: "#5e4719",
          900: "#4b3915",
          950: "#352810",
        },
        rose: {
          50: "#f9f1ee",
          100: "#f2e0da",
          200: "#e6c3b8",
          300: "#d59d8c",
          400: "#c27a64",
          500: "#b0583f",
          600: "#a24e36",
          700: "#87412d",
          800: "#6e3526",
          900: "#592b1f",
          950: "#3f1e15",
        },
        paper: "#f8f6f1",
        line: "#e8e3d8",
        mist: "#d9d3c6",
        good: "#4a7456",
        warn: "#8c6a22",
        bad: "#a24e36",
      },
      fontFamily: {
        display: ["Barlow", "Montserrat", "system-ui", "sans-serif"],
        sans: ["Montserrat", "system-ui", "-apple-system", "Segoe UI", "Microsoft YaHei", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(60, 50, 30, 0.05)",
        lift: "0 6px 18px -10px rgba(60, 50, 30, 0.25)",
        sheet: "0 1px 0 rgba(60, 50, 30, 0.04), 0 2px 10px -6px rgba(60, 50, 30, 0.12)",
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
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        stamp: {
          "0%": { opacity: "0", transform: "rotate(-6deg) scale(1.5)" },
          "100%": { opacity: "0.9", transform: "rotate(-6deg) scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in-up-fast": "fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scaleIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "tooltip-in": "tooltipIn 0.18s ease-out both",
        shake: "shake 0.45s ease-in-out both",
        shimmer: "shimmer 1.6s linear infinite",
        stamp: "stamp 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) 0.6s both",
      },
    },
  },
  plugins: [],
};
