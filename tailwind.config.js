/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        scan: {
          '0%, 100%': { top: '0%' },
          '50%': { top: '100%' }
        }
      },
      animation: {
        scan: 'scan 2s ease-in-out infinite'
      }
    }
  },
  plugins: [],
};
