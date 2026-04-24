/** @type {import('tailwindcss').Config} */
export default {
  content: [ "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {

        brand: {

          100: "#F5D0E2",

          500: "#A64D79",

          700: "#7A1036",

        },

        dark: {

          500: "#333333",

        }

      },

      fontFamily: {

        nunito: ["Nunito", "system-ui", "sans-serif"],

      }
    },
  },
  plugins: [],
}

