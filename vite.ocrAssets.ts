import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin } from 'vite'

interface OcrAsset {
  dest: string
  pkg: string
  files: string[]
}

const OCR_FILES: OcrAsset[] = [
  {
    dest: 'pdf.worker.min.mjs',
    pkg: 'pdfjs-dist',
    files: [
      'build/pdf.worker.min.mjs',
      'build/pdf.worker.mjs',
      'legacy/build/pdf.worker.min.mjs',
      'legacy/build/pdf.worker.mjs',
    ],
  },
  {
    dest: 'worker.min.js',
    pkg: 'tesseract.js',
    files: ['dist/worker.min.js', 'dist/worker.js'],
  },
  {
    dest: 'tesseract-core-lstm.wasm.js',
    pkg: 'tesseract.js-core',
    files: [
      'tesseract-core-lstm.wasm.js',
      'tesseract-core-simd-lstm.wasm.js',
      'tesseract-core.wasm.js',
    ],
  },
  {
    dest: 'tesseract-core-lstm.wasm',
    pkg: 'tesseract.js-core',
    files: [
      'tesseract-core-lstm.wasm',
      'tesseract-core-simd-lstm.wasm',
      'tesseract-core.wasm',
    ],
  },
]

const LANG_URLS = [
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
  'https://tessdata.projectnaptha.com/4.0.0/por.traineddata.gz',
]

function packageDir(rootDir: string, name: string) {
  try {
    const require = createRequire(path.join(rootDir, 'package.json'))
    return path.dirname(require.resolve(`${name}/package.json`))
  } catch {
    const fallback = path.join(rootDir, 'node_modules', name)
    return fs.existsSync(path.join(fallback, 'package.json')) ? fallback : null
  }
}

function resolveSource(rootDir: string, asset: OcrAsset) {
  const dir = packageDir(rootDir, asset.pkg)
  if (!dir) return null
  for (const file of asset.files) {
    const from = path.join(dir, file)
    if (fs.existsSync(from)) return from
  }
  return null
}

function copyIfNeeded(from: string, to: string) {
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) return
  fs.copyFileSync(from, to)
}

async function ensureLanguageData(destDir: string) {
  const dest = path.join(destDir, 'por.traineddata.gz')
  if (fs.existsSync(dest) && fs.statSync(dest).size > 50_000) return
  for (const url of LANG_URLS) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength < 50_000) continue
      fs.writeFileSync(dest, buffer)
      return
    } catch {
      continue
    }
  }
}

export function ocrAssetsPlugin(rootDir: string): Plugin {
  const destDir = path.join(rootDir, 'public', 'ocr')
  return {
    name: 'ocr-assets',
    async buildStart() {
      fs.mkdirSync(destDir, { recursive: true })
      for (const asset of OCR_FILES) {
        const from = resolveSource(rootDir, asset)
        if (!from) {
          this.warn(
            `OCR: ${asset.dest} não encontrado. Rode npm install e suba o Vite de novo para importar PDF digitalizado.`,
          )
          continue
        }
        copyIfNeeded(from, path.join(destDir, asset.dest))
      }
      await ensureLanguageData(destDir)
    },
  }
}
