import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { extractPdfJpegImages } from '../../../supabase/functions/_shared/statement/pdfExtract.ts'
import type { PdfOcrInput, PdfOcrResult } from '../../../supabase/functions/_shared/statement/ocr.ts'

const MAX_TEXT_PAGES = 40
const MAX_OCR_PAGES = 25
const DATE_RE = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/
const AMOUNT_RE = /\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+[.,]\d{2}/

let workerConfigured = false

function ocrAsset(name: string) {
  return new URL(`/ocr/${name}`, window.location.origin).href
}

function ocrLangPath() {
  return new URL('/ocr', window.location.origin).href
}

function ensurePdfWorker() {
  if (workerConfigured) return
  GlobalWorkerOptions.workerSrc = ocrAsset('pdf.worker.min.mjs')
  workerConfigured = true
}

function compactLength(text: string) {
  return text.replace(/\s+/g, '').length
}

function looksLikeStatement(text: string) {
  if (compactLength(text) < 24) return false
  return DATE_RE.test(text) && AMOUNT_RE.test(text)
}

interface PdfRun {
  x: number
  y: number
  text: string
  width: number
  height: number
}

function layoutFromRuns(runs: PdfRun[]) {
  if (runs.length === 0) return ''
  const sorted = [...runs].sort((left, right) => right.y - left.y || left.x - right.x)
  const rows: PdfRun[][] = []
  let current: PdfRun[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i += 1) {
    const run = sorted[i]
    const probe = current[0]
    const tol = Math.max(2.5, Math.min(probe.height || 12, run.height || 12) * 0.45)
    if (Math.abs(run.y - probe.y) <= tol) current.push(run)
    else {
      rows.push(current)
      current = [run]
    }
  }
  rows.push(current)

  return rows
    .map((row) => {
      const ordered = [...row].sort((left, right) => left.x - right.x)
      const cells: string[] = []
      let buffer = ''
      let last: PdfRun | null = null
      for (const run of ordered) {
        const text = run.text.replace(/\s+/g, ' ').trim()
        if (!text) continue
        if (!last) {
          buffer = text
          last = run
          continue
        }
        const gap = run.x - (last.x + last.width)
        if (gap > Math.max(10, last.height * 1.1)) {
          cells.push(buffer)
          buffer = text
        } else {
          buffer += `${gap > 1.5 ? ' ' : ''}${text}`
        }
        last = run
      }
      if (buffer) cells.push(buffer)
      return cells.join('  ')
    })
    .filter(Boolean)
    .join('\n')
}

async function textFromPage(page: PDFPageProxy) {
  const content = await page.getTextContent({ includeMarkedContent: false })
  const runs: PdfRun[] = []
  for (const item of content.items) {
    if (!('str' in item) || typeof item.str !== 'string') continue
    const transform = Array.isArray(item.transform) ? item.transform : []
    runs.push({
      x: Number(transform[4] ?? 0),
      y: Number(transform[5] ?? 0),
      text: item.str,
      width: Number(item.width ?? 0),
      height: Number(item.height ?? 12),
    })
  }
  const laidOut = layoutFromRuns(runs)
  if (laidOut.trim()) return laidOut
  return content.items
    .map((item) => ('str' in item ? String(item.str ?? '') : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pageViewport(page: PDFPageProxy) {
  const base = page.getViewport({ scale: 1 })
  const maxEdge = 2000
  const scale = Math.min(2, maxEdge / Math.max(base.width, base.height, 1))
  return page.getViewport({ scale: Math.max(1.35, scale) })
}

async function renderPage(page: PDFPageProxy) {
  const viewport = pageViewport(page)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const canvasContext = canvas.getContext('2d', { willReadFrequently: true })
  if (!canvasContext) throw new Error('Não foi possível desenhar a página do PDF.')
  canvasContext.fillStyle = '#ffffff'
  canvasContext.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext, canvas, viewport }).promise
  return canvas
}

function jpegBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: 'image/jpeg' })
}

async function ocrImages(images: Array<HTMLCanvasElement | Blob>): Promise<string> {
  if (images.length === 0) return ''
  const worker = await createWorker('por', 1, {
    logger: () => undefined,
    workerPath: ocrAsset('worker.min.js'),
    corePath: ocrAsset('tesseract-core-lstm.wasm.js'),
    langPath: ocrLangPath(),
    gzip: true,
  })
  const parts: string[] = []
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const limit = Math.min(images.length, MAX_OCR_PAGES)
    for (let i = 0; i < limit; i += 1) {
      const recognized = await worker.recognize(images[i])
      const text = recognized.data.text?.trim()
      if (text) parts.push(text)
      const image = images[i]
      if (image instanceof HTMLCanvasElement) {
        image.width = 0
        image.height = 0
      }
    }
  } finally {
    await worker.terminate()
  }
  return parts.join('\n')
}

async function extractWithPdfJs(bytes: Uint8Array) {
  ensurePdfWorker()
  const loadingTask = getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: true,
    useWasm: false,
    useWorkerFetch: false,
    verbosity: 0,
  })
  const pdf = await loadingTask.promise
  const pages: PDFPageProxy[] = []
  try {
    const pageCount = Math.min(pdf.numPages, MAX_TEXT_PAGES)
    const nativeParts: string[] = []
    for (let index = 1; index <= pageCount; index += 1) {
      const page = await pdf.getPage(index)
      pages.push(page)
      nativeParts.push(await textFromPage(page))
    }
    return {
      text: nativeParts.filter(Boolean).join('\n').trim(),
      pages,
      cleanup: async () => {
        await pdf.cleanup()
        await loadingTask.destroy()
      },
    }
  } catch (error) {
    await pdf.cleanup().catch(() => undefined)
    await loadingTask.destroy().catch(() => undefined)
    throw error
  }
}

export async function recoverPdfText({ bytes }: PdfOcrInput): Promise<PdfOcrResult | null> {
  if (typeof document === 'undefined') return null

  let opened: Awaited<ReturnType<typeof extractWithPdfJs>> | null = null
  try {
    opened = await extractWithPdfJs(bytes)
  } catch {
    /* worker do pdf.js falhou; o OCR usa JPEG embutido */
  }

  const nativeText = opened?.text ?? ''
  const pages = opened?.pages ?? []
  if (looksLikeStatement(nativeText)) {
    await opened?.cleanup().catch(() => undefined)
    return { text: nativeText, usedOcr: false }
  }

  try {
    const images: Array<HTMLCanvasElement | Blob> = []
    if (pages.length > 0) {
      try {
        const limit = Math.min(pages.length, MAX_OCR_PAGES)
        for (let i = 0; i < limit; i += 1) {
          images.push(await renderPage(pages[i]))
        }
      } catch {
        images.length = 0
      }
    }
    if (images.length === 0) {
      const jpegs = await extractPdfJpegImages(bytes)
      for (const jpeg of jpegs.slice(0, MAX_OCR_PAGES)) {
        images.push(jpegBlob(jpeg))
      }
    }
    const ocrText = await ocrImages(images)
    if (compactLength(ocrText) >= 24) {
      return { text: ocrText, usedOcr: true }
    }
    if (nativeText) return { text: nativeText, usedOcr: false }
    return null
  } catch {
    if (nativeText) return { text: nativeText, usedOcr: false }
    return null
  } finally {
    await opened?.cleanup().catch(() => undefined)
  }
}
