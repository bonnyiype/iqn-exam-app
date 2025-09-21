import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DEV_SERVER_PORT } from './config/devServer.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_SERVER_PORT,
    open: true
  }
})
