import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
   plugins: [react(), tailwindcss()],
     resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
   build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: './index.html',
        background: './src/background.js',
        content: './src/content.js',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'popup' ? 'assets/[name]-[hash].js' : '[name].js'
        },
      },
    },
  },
})
