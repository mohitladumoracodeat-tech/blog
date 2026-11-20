/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Modern Editorial semantic tokens
        background: "rgb(var(--bg-app-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--bg-surface-rgb) / <alpha-value>)",
          elevated: "var(--bg-surface-elevated)",
          muted: "var(--bg-surface-muted)",
        },
        primary: {
          DEFAULT: "rgb(var(--color-primary-rgb) / <alpha-value>)",
          hover: "var(--color-primary-hover)",
          contrast: "var(--color-primary-contrast)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          subtle: "var(--color-accent-subtle)",
          hover: "var(--color-accent-hover)",
        },
        editorial: {
          text: "rgb(var(--color-text-rgb) / <alpha-value>)",
          muted: "rgb(var(--color-muted-rgb) / <alpha-value>)",
          border: "var(--color-border)",
        },

        // Backward compatibility mappings (seamlessly theme-aware)
        paper: "rgb(var(--bg-app-rgb) / <alpha-value>)",
        ink: "rgb(var(--color-text-rgb) / <alpha-value>)",
        moss: "rgb(var(--color-primary-rgb) / <alpha-value>)",
        lime: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "Cambria", "'Times New Roman'", "Times", "serif"],
        serif: ["'Playfair Display'", "Georgia", "Cambria", "'Times New Roman'", "Times", "serif"],
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "Helvetica", "Arial", "sans-serif"],
        reading: ["'Playfair Display'", "Georgia", "Cambria", "'Times New Roman'", "Times", "serif"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
      },
      borderRadius: {
        editorial: "14px",
      },
    },
  },
  plugins: [],
};
