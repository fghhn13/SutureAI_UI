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
      },
    },
  },
  plugins: [],
};
