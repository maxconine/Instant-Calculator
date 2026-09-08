import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

function copyMathliveFonts(): Plugin {
  const copy = () => {
    const src = resolve(root, 'node_modules/mathlive/fonts')
    const dest = resolve(root, 'public/mathlive-fonts')
    mkdirSync(dest, { recursive: true })
    for (const file of readdirSync(src)) {
      copyFileSync(resolve(src, file), resolve(dest, file))
    }
  }
  return {
    name: 'copy-mathlive-fonts',
    buildStart: copy,
    configureServer: copy,
  }
}

export default defineConfig({
  plugins: [react(), copyMathliveFonts()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        quick: resolve(root, 'quick.html'),
      },
    },
  },
})

