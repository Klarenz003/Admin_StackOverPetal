// Admin Vite on 5184 and isolated Chrome CDP on 9243. No live data used.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
;(async () => {
  const tabs = await (await fetch('http://127.0.0.1:9243/json')).json()
  const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
  let id = 0; const pending = new Map()
  const send = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id) } if (m.method === 'Fetch.requestPaused') send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from('[]').toString('base64') }) })
  const run = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value }
  try {
    await send('Runtime.enable'); await send('Page.enable')
    await send('Fetch.enable', { patterns: [{ urlPattern: '*rest/v1/*' }, { urlPattern: '*auth/v1/*' }] })
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: 'http://127.0.0.1:5184/' }); await delay(1600)
    const result = await run(`(async()=>{
      const art=await import('/src/utils/giftCardArtwork.ts'), exporter=await import('/src/utils/giftCardPng.ts');
      const code={id:'print-test',public_token:'000000000000000000000000000000000000',activation_code:'DEMO-1234'};
      const url=art.giftClaimUrl('https://www.stackoverpetals.shop',code.public_token);
      const templates=await art.loadGiftCardTemplates();
      const front=art.giftCardSvg('front',code,url,{templates,transparent:true}),back=art.giftCardSvg('back',code,url,{templates,transparent:true});
      document.body.innerHTML='<main style="padding:30px;background:#e8ddd2"><img style="width:100%;max-width:1000px;display:block;margin:auto auto 24px" id="front"><img style="width:100%;max-width:1000px;display:block;margin:auto" id="back"></main>';
      document.querySelector('#front').src=art.svgDataUrl(front); document.querySelector('#back').src=art.svgDataUrl(back);
      await Promise.all([...document.images].map(i=>i.decode()));
      const png=await exporter.createGiftCardPng([code],'https://www.stackoverpetals.shop');
      window.testPng=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(png.blob)});
      const batch=await exporter.createGiftCardPng(Array.from({length:5},(_,i)=>({...code,id:'test-'+i})),'https://www.stackoverpetals.shop');
      const single=await exporter.createGiftCardPng([code],'https://www.stackoverpetals.shop','front');
      const reverse=await exporter.createGiftCardPng([code],'https://www.stackoverpetals.shop','back');
      return {width:png.width,height:png.height,batchWidth:batch.width,batchHeight:batch.height,singleWidth:single.width,reverseWidth:reverse.width,codeOnFront:front.includes('DEMO-1234'),codeOnBack:back.includes('DEMO-1234'),scratch:back.includes('Scratch'),quietZone:art.GIFT_CARD.quietZone,contact:back.includes(art.LOST_CARD_URL),logo:front.includes('data:image/svg+xml')};
    })()`)
    assert.equal(result.width,2150); assert.equal(result.height,638)
    assert.equal(result.batchWidth,2150); assert.equal(result.batchHeight,3286); assert.equal(result.singleWidth,1063); assert.equal(result.reverseWidth,1063)
    assert.equal(result.codeOnFront, false); assert.equal(result.codeOnBack, true); assert.equal(result.scratch, false); assert.equal(result.quietZone, 4)
    assert.equal(result.contact, true); assert.equal(result.logo, true)
    fs.writeFileSync(path.join(process.env.TEMP, 'stack-petals-print-test.png'), Buffer.from((await run('window.testPng')).split(',')[1], 'base64'))
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(path.join(process.env.TEMP, 'stack-petals-print-preview.png'), Buffer.from(shot.result.data, 'base64'))
    console.log('PASS paired PNG, separate sides, compact five-pair sheet, code only on back, no scratch panel')
  } finally { await send('Browser.close'); ws.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
