import QRCode from 'qrcode'
import frontSource from '@/assets/gift-cards/front-original.png'
import backSource from '@/assets/gift-cards/back-original.png'
import flowerSource from '@/assets/gift-cards/qr-flower-mark.svg?raw'

export type GiftCardCode = { id: string; public_token: string; activation_code: string }
export type GiftCardTemplates = { front: string; back: string }
export const LOST_CARD_URL = 'https://www.stackoverpetals.shop/contact'
export const GIFT_CARD = { width: 90, height: 54, bleed: 3, marks: 4, artWidth: 1000, artHeight: 600, qr: { x: 639, y: 109, size: 288 }, quietZone: 4, logoRatio: .15, plateRatio: .18, activation: { x: 650, y: 407 } } as const
export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
export const QR_FLOWER_URL = svgDataUrl(flowerSource)
let templatesPromise: Promise<GiftCardTemplates> | null = null
async function embeddedImage(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Gift card artwork could not be loaded.')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob)
  })
}
export function loadGiftCardTemplates() {
  if (!templatesPromise) templatesPromise = Promise.all([embeddedImage(frontSource), embeddedImage(backSource)])
    .then(([front, back]) => ({ front, back })).catch(error => { templatesPromise = null; throw error })
  return templatesPromise
}
export function giftClaimUrl(site: string, token: string) {
  const url = new URL(site)
  if (!['https:', 'http:'].includes(url.protocol) || !token.trim()) throw new Error('A valid storefront URL and QR token are required.')
  return `${url.origin}${url.pathname.replace(/\/$/, '')}/letter-v2/claim/${encodeURIComponent(token)}`
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
export function qrLogoSvg() {
  const { x, y, size } = GIFT_CARD.qr
  const plate = size * GIFT_CARD.plateRatio, logo = size * GIFT_CARD.logoRatio
  return `<rect x="${x + (size - plate) / 2}" y="${y + (size - plate) / 2}" width="${plate}" height="${plate}" rx="6" fill="#fffaf5" stroke="#c69b65" stroke-width=".65"/><image href="${escape(QR_FLOWER_URL)}" x="${x + (size - logo) / 2}" y="${y + (size - logo) / 2}" width="${logo}" height="${logo}"/>`
}
export function qrModulesSvg(url: string) {
  const matrix = QRCode.create(url, { errorCorrectionLevel: 'H' }).modules
  const { x, y, size } = GIFT_CARD.qr, unit = size / (matrix.size + 8)
  const rects: string[] = []
  const eyes = [[0, 0], [matrix.size - 7, 0], [0, matrix.size - 7]]
  for (let row = 0; row < matrix.size; row++) for (let col = 0; col < matrix.size; col++) {
    if (eyes.some(([cx, cy]) => col >= cx && col < cx + 7 && row >= cy && row < cy + 7)) continue
    if (matrix.get(row, col)) rects.push(`<rect x="${x + (col + 4) * unit}" y="${y + (row + 4) * unit}" width="${unit}" height="${unit}" rx="${unit * .13}"/>`)
  }
  const finderEyes = eyes.map(([cx, cy]) => `<g transform="translate(${x + (cx + 4) * unit} ${y + (cy + 4) * unit})"><rect width="${unit * 7}" height="${unit * 7}" rx="${unit * .8}" fill="#713528"/><rect x="${unit}" y="${unit}" width="${unit * 5}" height="${unit * 5}" rx="${unit * .45}" fill="#fffaf5"/><rect x="${unit * 2}" y="${unit * 2}" width="${unit * 3}" height="${unit * 3}" rx="${unit * .5}" fill="#542b24"/></g>`).join('')
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fffaf5"/><g fill="#542b24">${rects.join('')}</g>${finderEyes}${qrLogoSvg()}`
}
export function giftCardSvg(side: 'front' | 'back', code: GiftCardCode, url: string, options: { bleed?: boolean; qr?: boolean; activation?: boolean; transparent?: boolean; templates: GiftCardTemplates }) {
  const bleed = options.bleed ? 1000 * GIFT_CARD.bleed / GIFT_CARD.width : 0
  const source = options.templates[side]
  // PNGs stay untouched; localized SVG overlays replace only dynamic fields.
  const image = `<image href="${escape(source)}" width="1000" height="600" preserveAspectRatio="none"/>`
  const front = options.qr === false ? `<rect x="639" y="109" width="288" height="288" fill="white"/>` : qrModulesSvg(url)
  const back = `<defs><linearGradient id="code-paper" x2="0" y2="1"><stop stop-color="#fff8f0"/><stop offset="1" stop-color="#f5e9dc"/></linearGradient><linearGradient id="code-gold"><stop stop-color="#9b621d"/><stop offset=".5" stop-color="#e4b263"/><stop offset="1" stop-color="#b1792c"/></linearGradient><pattern id="original-paper" width="100" height="18" patternUnits="userSpaceOnUse"><image href="${escape(options.templates.back)}" x="-455" y="-179" width="1000" height="600" preserveAspectRatio="none"/></pattern></defs>
    <rect x="452" y="197" width="516" height="38" fill="url(#original-paper)"/>
    <text x="710" y="225" text-anchor="middle" fill="#532818" font-family="Georgia,serif" font-size="25">Use the activation code below to begin.</text>
    <rect x="329" y="328" width="639" height="124" rx="24" fill="url(#code-paper)" stroke="url(#code-gold)" stroke-width="4"/>
    ${options.activation === false ? '' : `<text x="650" y="407" text-anchor="middle" fill="#742921" font-family="'Courier New',monospace" font-weight="bold" font-size="${Math.min(56, 490 / Math.max(code.activation_code.length, 1))}">${escape(code.activation_code)}</text>`}
    <rect x="434" y="535" width="520" height="34" rx="12" fill="#fff9f0" fill-opacity=".94"/>
    <a href="${LOST_CARD_URL}"><text x="694" y="557" text-anchor="middle" fill="#633b29" font-family="Georgia,serif" font-size="17">If lost, contact: ${LOST_CARD_URL}</text></a>`
  const edges = bleed ? `<svg x="${-bleed}" y="0" width="${bleed}" height="600" viewBox="0 0 1 600" preserveAspectRatio="none">${image}</svg><svg x="1000" y="0" width="${bleed}" height="600" viewBox="999 0 1 600" preserveAspectRatio="none">${image}</svg><svg x="0" y="${-bleed}" width="1000" height="${bleed}" viewBox="0 0 1000 1" preserveAspectRatio="none">${image}</svg><svg x="0" y="600" width="1000" height="${bleed}" viewBox="0 599 1000 1" preserveAspectRatio="none">${image}</svg>` : ''
  const content = `${image}${side === 'front' ? front : back}`
  const body = options.transparent ? `<defs><clipPath id="card-trim"><rect width="1000" height="600" rx="44"/></clipPath></defs><g clip-path="url(#card-trim)">${content}</g>` : `<rect x="${-bleed}" y="${-bleed}" width="${1000 + bleed * 2}" height="${600 + bleed * 2}" fill="#f6e9dc"/>${edges}${content}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${1000 + bleed * 2}" height="${600 + bleed * 2}" viewBox="${-bleed} ${-bleed} ${1000 + bleed * 2} ${600 + bleed * 2}">${body}</svg>`
}
