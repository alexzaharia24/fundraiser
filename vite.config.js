import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localSettings } from './lib/local-settings.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [localSettings(), react()],
})
