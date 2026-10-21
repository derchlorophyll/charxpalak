/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0f0fe',
          200: '#b9e2fe',
          300: '#7cd0fd',
          400: '#36bbf8',
          500: '#0c9ee9',
          600: '#017ec7',
          700: '#0265a1',
          800: '#075585',
          900: '#0c466e',
          950: '#082d49',
        },
        navy: {
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554'
        }
      }
    },
  },
  plugins: [],
}
