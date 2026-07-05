/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#141414',
        surface: '#0a0a0a',
        border: '#262626',
        accent: '#e8b464',
        shared: '#8b8b8b',
        added: '#34d399',
        removed: '#f87171',
      },
    },
  },
  plugins: [],
};
