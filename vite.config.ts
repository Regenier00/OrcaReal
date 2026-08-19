import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { resolveSupabaseCredentials } from './src/lib/supabaseEnv.ts'
import { ocrAssetsPlugin } from './vite.ocrAssets.ts'

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const { url, key } = resolveSupabaseCredentials({
    ...process.env,
    ...fileEnv,
  })

  // Vite só injeta no client variáveis com prefixo VITE_.
  // Promove aliases (publishable, nomes sem prefixo, secrets do ambiente).
  if (url) process.env.VITE_SUPABASE_URL = url
  if (key) {
    process.env.VITE_SUPABASE_ANON_KEY = key
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = key
  }

  const define: Record<string, string> = {}
  if (url) {
    define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(url)
  }
  if (key) {
    define['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(key)
    define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'] = JSON.stringify(key)
  }

  return {
    plugins: [react(), tailwindcss(), ocrAssetsPlugin(path.resolve(import.meta.dirname))],
    define,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        // Pacote CJS: o Vite servia src/index.js sem export nomeado createWorker.
        'tesseract.js': path.resolve(
          import.meta.dirname,
          'node_modules/tesseract.js/dist/tesseract.esm.min.js',
        ),
      },
    },
    optimizeDeps: {
      // tesseract.js é CJS (src/index.js usa module.exports). Se ficar em
      // exclude, o Vite serve esse arquivo como ESM e createWorker some.
      include: ['tesseract.js'],
      needsInterop: ['tesseract.js'],
      exclude: ['pdfjs-dist', 'tesseract.js-core'],
    },
    worker: {
      format: 'es',
    },
  }
})
