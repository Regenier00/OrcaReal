import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'
import type { PdfOcrInput, PdfOcrResult } from '../../../supabase/functions/_shared/statement/ocr.ts'

const MAX_TEXT_PAGES = 40
const MAX_OCR_PAGES = 25
const DATE_RE = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/
const AMOUNT_RE = /\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+[.,]\d{2}/

let workerConfigured = false

function ensurePdfWorker() {
  if (workerConfigured) return
  GlobalWorkerOptions.workerSrc = pdfWorker
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

async function ocrPages(
  pages: PDFPageProxy[],
  pageCount: number,
): Promise<string> {
  const worker = await createWorker('por', 1, { logger: () => undefined })
  const parts: string[] = []
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const limit = Math.min(pageCount, MAX_OCR_PAGES, pages.length)
    for (let i = 0; i < limit; i += 1) {
      const canvas = await renderPage(pages[i])
      const recognized = await worker.recognize(canvas)
      const text = recognized.data.text?.trim()
      if (text) parts.push(text)
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    await worker.terminate()
  }
  return parts.join('\n')
}

export async function recoverPdfText({ bytes }: PdfOcrInput): Promise<PdfOcrResult | null> {
  if (typeof document === 'undefined') return null
  ensurePdfWorker()

  const loadingTask = getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: true,
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
    const nativeText = nativeParts.filter(Boolean).join('\n').trim()
    if (looksLikeStatement(nativeText)) {
      return { text: nativeText, usedOcr: false }
    }

    const ocrText = await ocrPages(pages, pageCount)
    if (compactLength(ocrText) >= 24) {
      return { text: ocrText, usedOcr: true }
    }
    if (nativeText) return { text: nativeText, usedOcr: false }
    return null
  } finally {
    await pdf.cleanup()
    await loadingTask.destroy()
  }
}
