const MAX_BYTES = 4 * 1024 * 1024
const OUTPUT_SIZE = 256
const SVG_MAX_BYTES = 80_000

export function companyInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return 'OR'
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('A imagem deve ter no máximo 4 MB.')
  }

  if (file.type === 'image/svg+xml' && file.size <= SVG_MAX_BYTES) {
    return readAsDataUrl(file)
  }

  const source = await readAsDataUrl(file)
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Não foi possível preparar a logo.')
  }

  const scale = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height)
  const width = image.width * scale
  const height = image.height * scale
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  context.drawImage(
    image,
    (OUTPUT_SIZE - width) / 2,
    (OUTPUT_SIZE - height) / 2,
    width,
    height
  )

  return canvas.toDataURL('image/jpeg', 0.84)
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Não foi possível ler a imagem.'))
    }
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
    image.src = src
  })
}
