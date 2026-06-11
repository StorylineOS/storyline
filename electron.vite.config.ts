import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('electron/main/index.ts') },
        // Emit CommonJS so native CJS modules (better-sqlite3) load cleanly under
        // Electron's Node — ESM main can't preparse native addon exports.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('electron/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('electron/preload/index.ts') },
        // A sandboxed preload (sandbox: true) must be CommonJS, so emit `.cjs`.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
    resolve: {
      alias: { '@shared': resolve('src/shared') },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
})
