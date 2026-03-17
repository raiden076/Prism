/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'prism-black': '#0a0a0a',
        'prism-white': '#fdfdfd',
        'prism-surface': '#171717',
        'prism-success': '#00FF00', // Aggressive Green
        'prism-crisis': '#FF0000',  // Stark Red
      },
      fontFamily: {
        // Enforcing heavy sans-serif typography for high legibility
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Unblurred drop-shadows mimicking heavy physical hardware switches
        'solid-sm': '2px 2px 0px 0px rgba(0, 0, 0, 1)',
        'solid-md': '4px 4px 0px 0px rgba(0, 0, 0, 1)',
        'solid-lg': '8px 8px 0px 0px rgba(0, 0, 0, 1)',
      },
    },
  },
  plugins: [],
}

