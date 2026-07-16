import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forwards to the local Express dev server (server/dev-server.js),
      // which mounts the same shared handlers as the Vercel functions in api/.
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
})