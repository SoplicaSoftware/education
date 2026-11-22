import type { ClipboardEvent } from 'react'

const MAX_DIMENSION = 1600
const KEEP_ORIGINAL_BELOW = 400 * 1024

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Nie udało się odczytać pliku.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazu.'))
    img.src = src
  })
}

/**
 * Turns an image file into a base64 data URL. Large photos are downscaled and
 * re-encoded so a deck with many micrographs still fits comfortably in storage.
 */
export async function imageFileToDataUrl(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Wybrany plik nie jest obrazem.')
  const original = await readAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return original

  const img = await loadImage(original)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale === 1 && file.size <= KEEP_ORIGINAL_BELOW) return original

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const compressed = canvas.toDataURL('image/jpeg', 0.86)
  return compressed.length < original.length ? compressed : original
}

export function imageFromClipboard(event: ClipboardEvent): File | null {
  for (const item of event.clipboardData.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}
