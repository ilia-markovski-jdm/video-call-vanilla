// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        deviceFirebase: './views/device-firebase/index.html',
        webFirebase: './views/web-firebase/index.html',
        webVanilla: './views/web-vanilla/index.html',
      }
    }
  }
})