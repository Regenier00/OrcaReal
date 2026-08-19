import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const OCR_FILES: Array<[string, string]> = [
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
]

const LANG_URLS = [
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
  'https://tessdata.projectnaptha.com/4.0.0/por.traineddata.gz',
]

function copyFile(from: string, to: string) {
  if (!fs.existsSync(from)) {
    throw new Error(`Arquivo OCR ausente: ${from}`)
  }
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
      for (const [source, name] of OCR_FILES) {
        copyFile(path.join(rootDir, 'node_modules', source), path.join(destDir, name))
      }
      await ensureLanguageData(destDir)
    },
  }
}
