/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0d0a',
        moss: '#8aa06b',
        clay: '#b9673f',
        paper: '#e9e5da',
      },
    },
  },
  plugins: [],
};
