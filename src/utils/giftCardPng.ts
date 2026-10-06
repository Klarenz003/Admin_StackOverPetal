import { GIFT_CARD, giftCardSvg, giftClaimUrl, loadGiftCardTemplates, svgDataUrl, type GiftCardCode, type GiftCardTemplates } from './giftCardArtwork'

export const PNG_PRINT = { dpi: 300, cardWidth: 1063, cardHeight: 638, gap: 24, pairsPerSheet: 5 } as const
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
// Canvas PNG defaults to 96 dpi. Replace pHYs so print tools see the intended 300 dpi.
export async function pngWithPrintDpi(blob: Blob): Promise<Blob> {
  const source = new Uint8Array(await blob.arrayBuffer()), view = new DataView(source.buffer)
  const chunk = new Uint8Array(21), chunkView = new DataView(chunk.buffer)
  chunkView.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4)
  chunkView.setUint32(8, Math.round(PNG_PRINT.dpi / .0254)); chunkView.setUint32(12, Math.round(PNG_PRINT.dpi / .0254)); chunk[16] = 1
  chunkView.setUint32(17, crc32(chunk.subarray(4, 17)))
  const parts: BlobPart[] = [source.slice(0, 8)]
  for (let offset = 8; offset < source.length;) {
    const length = view.getUint32(offset), end = offset + length + 12
    const type = String.fromCharCode(...source.subarray(offset + 4, offset + 8))
    if (type !== 'pHYs') parts.push(source.slice(offset, end))
    if (type === 'IHDR') parts.push(chunk)
    offset = end
  }
  return new Blob(parts, { type: 'image/png' })
}
async function cardImage(side: 'front' | 'back', code: GiftCardCode, site: string, templates: GiftCardTemplates) {
  const image = new Image(); image.src = svgDataUrl(giftCardSvg(side, code, giftClaimUrl(site, code.public_token), { templates, transparent: true }))
  await image.decode(); return image
}
export async function createGiftCardPng(codes: GiftCardCode[], site: string, sides: 'both' | 'front' | 'back' = 'both') {
  if (!codes.length || codes.length > PNG_PRINT.pairsPerSheet) throw new Error('Use one to five cards per compact sheet.')
  const templates = await loadGiftCardTemplates(), canvas = document.createElement('canvas')
  const columns = sides === 'both' ? 2 : 1
  canvas.width = PNG_PRINT.cardWidth * columns + PNG_PRINT.gap * (columns - 1)
  canvas.height = PNG_PRINT.cardHeight * codes.length + PNG_PRINT.gap * (codes.length - 1)
  const context = canvas.getContext('2d'); if (!context) throw new Error('Unable to prepare the PNG.')
  // No canvas fill: corners, gaps and everything outside the cards remain transparent.
  for (let row = 0; row < codes.length; row++) {
    const list = sides === 'both' ? ['front', 'back'] as const : [sides]
    for (let column = 0; column < list.length; column++) {
      const image = await cardImage(list[column], codes[row], site, templates)
      context.drawImage(image, column * (PNG_PRINT.cardWidth + PNG_PRINT.gap), row * (PNG_PRINT.cardHeight + PNG_PRINT.gap), PNG_PRINT.cardWidth, PNG_PRINT.cardHeight)
    }
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'))
  return { blob: await pngWithPrintDpi(blob), width: canvas.width, height: canvas.height, cardSize: `${GIFT_CARD.width}×${GIFT_CARD.height} mm` }
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export async function downloadGiftCardPng(code: GiftCardCode, site: string, sides: 'both' | 'front' | 'back' = 'both') {
  const result = await createGiftCardPng([code], site, sides)
  saveBlob(result.blob, `stack-petals-${code.id.replace(/[^a-z0-9-]/gi, '').slice(0, 12)}-${sides}-300dpi.png`)
}
export async function downloadGiftCardBatch(codes: GiftCardCode[], site: string) {
  if (!codes.length || codes.length > 200) throw new Error('Choose one to 200 cards.')
  if (codes.length <= PNG_PRINT.pairsPerSheet) { const result = await createGiftCardPng(codes, site); saveBlob(result.blob, 'stack-petals-compact-cards-300dpi.png'); return }
  const { zipSync } = await import('fflate'), files: Record<string, Uint8Array> = {}
  for (let start = 0; start < codes.length; start += PNG_PRINT.pairsPerSheet) {
    const result = await createGiftCardPng(codes.slice(start, start + PNG_PRINT.pairsPerSheet), site)
    files[`stack-petals-sheet-${String(start / PNG_PRINT.pairsPerSheet + 1).padStart(2, '0')}-300dpi.png`] = new Uint8Array(await result.blob.arrayBuffer())
  }
  saveBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'stack-petals-compact-png-sheets.zip')
}
