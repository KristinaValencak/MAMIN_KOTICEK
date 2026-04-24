import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Opomba: ločevanje @chakra-ui in react v manualChunks je povzročilo
// "Cannot read properties of undefined (reading 'useLayoutEffect')" v produkciji.
export default defineConfig({
  plugins: [react()],
})
