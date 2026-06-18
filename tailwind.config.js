/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral dark palette for a creative tool
        panel: '#16171b',
        surface: '#1d1f24',
        border: '#2a2d34',
        accent: '#DCE775',
      },
    },
  },
  plugins: [],
}
