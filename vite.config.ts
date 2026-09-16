import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this as a project site under /drivon-passageiro/,
  // not the domain root — only applies to production builds so local dev
  // and the Browser preview keep working at plain localhost:5173/.
  base: command === "build" ? "/drivon-passageiro/" : "/",
  plugins: [tsconfigPaths(), react(), tailwindcss()],
  server: {
    host: true,
  },
}))
