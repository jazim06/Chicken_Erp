import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import custom plugins
import { createHealthCheckPlugin } from './plugins/health-check/vite-health-plugin.js'
// import babelMetadataPlugin from './plugins/visual-edits/babel-metadata-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|js|tsx|ts)$/,
      // Babel plugin for visual edits (commented until plugin is tested)
      // babel: {
      //   plugins: [babelMetadataPlugin]
      // }
    }),
    createHealthCheckPlugin()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  esbuild: {
    jsx: 'automatic',
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true
  }
})
