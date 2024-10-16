// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        deviceFirebase: './pocs/device-firebase/index.html',
        webFirebase: './pocs/web-firebase/index.html',
        webVanilla: './pocs/web-vanilla/index.html',
      }
    }
  }
})