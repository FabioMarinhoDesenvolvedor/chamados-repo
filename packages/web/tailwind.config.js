/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grena: { DEFAULT: '#6D1F3A', dark: '#5A1830', light: '#8A2E4C' },
        surface: '#F7F7F7',
      },
      boxShadow: {
        grena: '0 8px 20px -6px rgba(109, 31, 58, 0.20)',
      },
      backgroundImage: {
        'grena-gradient': 'linear-gradient(135deg, #6D1F3A, #5A1830)',
      },
    },
  },
  plugins: [],
};
