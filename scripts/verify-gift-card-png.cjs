const { createRequire } = require('node:module')
const { resolve, join } = require('node:path'), { readFileSync } = require('node:fs')
const assert = require('node:assert/strict')
;(async () => {
  const req = createRequire(join(resolve(process.argv[2]), 'package.json'))
  const { createCanvas, loadImage } = req('@napi-rs/canvas'), jsQR = req('jsqr')
  const bytes = readFileSync(process.argv[3])
  let density
  for (let n = 8; n < bytes.length;) {
    const size = bytes.readUInt32BE(n)
    if (bytes.toString('ascii', n + 4, n + 8) === 'pHYs') density = [bytes.readUInt32BE(n + 8), bytes.readUInt32BE(n + 12), bytes[n + 16]]
    n += size + 12
  }
  assert.deepEqual(density, [11811, 11811, 1])
  const source = await loadImage(bytes), output = createCanvas(source.width, source.height), context = output.getContext('2d')
  context.drawImage(source, 0, 0)
  const alpha = (x, y) => context.getImageData(x, y, 1, 1).data[3]
  assert.equal(alpha(0, 0), 0); assert.equal(alpha(1070, 300), 0); assert.equal(alpha(500, 300), 255)
  for (const scale of [1, .75, .5]) {
    const card = createCanvas(Math.round(1063 * scale), Math.round(638 * scale)), ctx = card.getContext('2d')
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, card.width, card.height)
    ctx.drawImage(source, 0, 0, 1063, 638, 0, 0, card.width, card.height)
    const image = ctx.getImageData(0, 0, card.width, card.height)
    assert.equal(jsQR(image.data, image.width, image.height)?.data, 'https://www.stackoverpetals.shop/letter-v2/claim/000000000000000000000000000000000000')
  }
  console.log('PASS transparent corners/gap, opaque artwork, 300 dpi metadata; themed QR decoded at 300/225/150 dpi')
})().catch(error => { console.error(error); process.exitCode = 1 })
