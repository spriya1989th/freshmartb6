/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans', 'system-ui', 'sans-serif'], mono: ['DM Mono', 'monospace'] },
      colors: {
        brand: { DEFAULT: '#059669', light: '#d1fae5', dark: '#047857' },
      },
      animation: { shimmer: 'shimmer 1.5s infinite' },
    },
  },
  plugins: [],
};
