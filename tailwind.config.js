/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        papaya: '#FF8000',
        papayaDark: '#CC6600',
        carbon: '#121212',
        asphalt: '#1C1C1C',
        steel: '#2A2A2A'
      }
    },
  },
  plugins: [],
}
