const fs = require('fs');

function mustReplace(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Could not apply ${label}: marker not found`);
  return source.replace(before, after);
}

// ---------------------------------------------------------------------------
// Frontend: make ORDER THIS ONE add to a real browser basket first.
// Checkout only starts when the customer chooses Checkout from the basket.
// ---------------------------------------------------------------------------
const appPath = 'public/app.js';
let app = fs.readFileSync(appPath, 'utf8');

const configMarker = "let config = { cardPricePence: 499, ukShippingPence: 199, photoAddOnPence: 100, checkoutReady: false, printer: 'approval-pending' };";
const basketRuntime = `${configMarker}\n\nconst BASKET_KEY = 'built-to-offend-basket-v1';\nlet basket = loadBasket();\n\nfunction loadBasket(){\n  try{\n    const parsed=JSON.parse(localStorage.getItem(BASKET_KEY)||'[]');\n    return Array.isArray(parsed)?parsed.slice(0,20):[];\n  }catch{return []}\n}\n\nfunction saveBasket(){\n  try{\n    const safe=basket.map(item=>({\n      ...item,\n      photoData:item.photoData&&item.photoData.length<=1800000?item.photoData:''\n    }));\n    localStorage.setItem(BASKET_KEY,JSON.stringify(safe));\n  }catch(e){console.warn('Basket storage unavailable',e)}\n}\n\nfunction updateBasketCount(){\n  const count=$('.mini-cart span');\n  if(count)count.textContent=String(basket.length);\n}\n\nfunction addToBasket(article,v,d,button){\n  const front=$('.front-copy',article).textContent.trim();\n  const inside=$('.inside-copy',article).textContent.trim();\n  const item={\n    id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),\n    front,inside,label:v.label,\n    data:{...d},\n    photoData:d.art==='photo'?selectedPhoto:'',\n    pricePence:currentCardPrice(d.art),\n    addedAt:Date.now()\n  };\n  basket.push(item);\n  saveBasket();\n  updateBasketCount();\n  const original=button.textContent;\n  button.textContent='✓ ADDED TO BASKET';\n  showToast('Added to basket.');\n  setTimeout(()=>{if(button.isConnected)button.textContent=original},1400);\n}\n\nfunction makeBasketPanel(){\n  let panel=$('#btoBasketPanel');\n  if(panel)return panel;\n  panel=document.createElement('div');\n  panel.id='btoBasketPanel';\n  panel.hidden=true;\n  Object.assign(panel.style,{position:'fixed',inset:'0',zIndex:'99999',background:'rgba(0,0,0,.78)',padding:'18px',overflow:'auto'});\n  const box=document.createElement('div');\n  box.id='btoBasketBox';\n  Object.assign(box.style,{maxWidth:'720px',margin:'30px auto',background:'#111318',color:'#fff',border:'1px solid #3b3e46',borderRadius:'18px',padding:'20px',boxShadow:'0 24px 80px rgba(0,0,0,.55)'});\n  const top=document.createElement('div');\n  Object.assign(top.style,{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'16px'});\n  const title=document.createElement('h2');title.textContent='YOUR BASKET';title.style.margin='0';\n  const close=document.createElement('button');close.type='button';close.textContent='✕';close.setAttribute('aria-label','Close basket');\n  Object.assign(close.style,{fontSize:'24px',background:'transparent',color:'#fff',border:'0',cursor:'pointer'});\n  close.addEventListener('click',()=>panel.hidden=true);\n  top.append(title,close);\n  const body=document.createElement('div');body.id='btoBasketItems';\n  box.append(top,body);panel.append(box);document.body.append(panel);\n  panel.addEventListener('click',e=>{if(e.target===panel)panel.hidden=true});\n  return panel;\n}\n\nfunction renderBasket(){\n  const panel=makeBasketPanel();\n  const body=$('#btoBasketItems',panel);\n  body.innerHTML='';\n  if(!basket.length){\n    const empty=document.createElement('p');empty.textContent='Your basket is empty.';body.append(empty);\n  }\n  for(const item of basket){\n    const row=document.createElement('article');\n    Object.assign(row.style,{padding:'16px',margin:'0 0 12px',background:'#1a1d23',borderRadius:'14px',border:'1px solid #30343d'});\n    const front=document.createElement('strong');front.textContent=item.front;front.style.display='block';front.style.marginBottom='8px';\n    const price=document.createElement('div');price.textContent=money(item.pricePence||config.cardPricePence);price.style.marginBottom='12px';\n    const actions=document.createElement('div');Object.assign(actions.style,{display:'flex',gap:'10px',flexWrap:'wrap'});\n    const checkout=document.createElement('button');checkout.type='button';checkout.textContent='CHECKOUT THIS CARD';checkout.className='btn primary';\n    checkout.addEventListener('click',()=>checkoutBasketItem(item,checkout));\n    const remove=document.createElement('button');remove.type='button';remove.textContent='REMOVE';remove.className='btn';\n    remove.addEventListener('click',()=>{basket=basket.filter(x=>x.id!==item.id);saveBasket();updateBasketCount();renderBasket()});\n    actions.append(checkout,remove);row.append(front,price,actions);body.append(row);\n  }\n  panel.hidden=false;\n}\n\nfunction checkoutBasketItem(item,button){\n  const article=document.createElement('article');\n  const front=document.createElement('div');front.className='front-copy';front.textContent=item.front;\n  const inside=document.createElement('div');inside.className='inside-copy';inside.textContent=item.inside;\n  article.append(front,inside);\n  const d={...(item.data||{})};\n  if(d.art==='photo'&&item.photoData)selectedPhoto=item.photoData;\n  return beginCheckout(article,{label:item.label||'THE MONSTER'},d,button);\n}\n`;

if (!app.includes("const BASKET_KEY = 'built-to-offend-basket-v1';")) {
  app = mustReplace(app, configMarker, basketRuntime, 'basket runtime');
}

app = mustReplace(
  app,
  "select.addEventListener('click',()=>beginCheckout(article,v,d,select));",
  "select.addEventListener('click',()=>addToBasket(article,v,d,select));",
  'order button basket handler'
);

// Prodigi's current 7x5 direct-mail greeting card exposes one `default`
// print area. Its template contains all four card panels in one image. Build
// that print sheet in-browser so the front, back and inside message are not lost.
if (!app.includes('async function renderProdigiSheetBlob(')) {
  const apiMarker = 'async function apiJson(path,options={})';
  const prodigiSheetRuntime = `async function drawBlobToCanvas(ctx,blob,x,y,w,h){\n  if(typeof createImageBitmap==='function'){\n    const bitmap=await createImageBitmap(blob);\n    try{ctx.drawImage(bitmap,x,y,w,h)}finally{if(bitmap.close)bitmap.close()}\n    return;\n  }\n  const url=URL.createObjectURL(blob);\n  try{const img=await loadImage(url);ctx.drawImage(img,x,y,w,h)}finally{URL.revokeObjectURL(url)}\n}\n\nasync function renderProdigiSheetBlob(front,inside,d){\n  const panelW=1500,panelH=2100;\n  const canvas=document.createElement('canvas');canvas.width=panelW*2;canvas.height=panelH*2;\n  const ctx=canvas.getContext('2d');\n  ctx.fillStyle='#f5f0e3';ctx.fillRect(0,0,canvas.width,canvas.height);\n\n  // Outside back panel — deliberately restrained branding.\n  ctx.fillStyle='#090a0c';ctx.fillRect(0,0,panelW,panelH);\n  ctx.fillStyle='#b9ff18';ctx.textAlign='center';ctx.font='900 66px Arial';ctx.fillText('BUILT TO OFFEND',panelW/2,panelH/2-35);\n  ctx.fillStyle='#ffffff';ctx.font='500 34px Arial';ctx.fillText('builttooffend.com',panelW/2,panelH/2+40);\n  ctx.fillStyle='#7a16a8';ctx.fillRect(panelW/2-150,panelH/2+90,300,16);\n\n  // Front panel.\n  const frontBlob=await renderPrintBlob(front,inside,d,'outside');\n  await drawBlobToCanvas(ctx,frontBlob,panelW,0,panelW,panelH);\n\n  // Inside-left panel stays clean for visual breathing room.\n  ctx.fillStyle='#f5f0e3';ctx.fillRect(0,panelH,panelW,panelH);\n  ctx.fillStyle='#6d6872';ctx.textAlign='center';ctx.font='500 27px Arial';ctx.fillText('BUILT TO OFFEND',panelW/2,panelH*2-130);\n\n  // Inside-right message panel.\n  const insideBlob=await renderPrintBlob(front,inside,d,'inside');\n  await drawBlobToCanvas(ctx,insideBlob,panelW,panelH,panelW,panelH);\n\n  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not render Prodigi print sheet')),'image/jpeg',.94));\n}\n\n${apiMarker}`;
  app = mustReplace(app, apiMarker, prodigiSheetRuntime, 'Prodigi single-sheet renderer');
}

app = mustReplace(
  app,
  "async function uploadAsset(orderId,token,kind,blob){return apiJson(`/api/order-asset?order_id=${encodeURIComponent(orderId)}&kind=${encodeURIComponent(kind)}`,{method:'PUT',headers:{'content-type':'image/png','x-order-token':token},body:blob})}",
  "async function uploadAsset(orderId,token,kind,blob){return apiJson(`/api/order-asset?order_id=${encodeURIComponent(orderId)}&kind=${encodeURIComponent(kind)}`,{method:'PUT',headers:{'content-type':blob.type||'image/png','x-order-token':token},body:blob})}",
  'asset MIME type handling'
);

app = mustReplace(
  app,
  "const [outside,insideBlob]=await Promise.all([renderPrintBlob(front,inside,d,'outside'),renderPrintBlob(front,inside,d,'inside')]);\n    button.textContent='SECURING YOUR MONSTER…';\n    await Promise.all([uploadAsset(order.orderId,order.uploadToken,'outside',outside),uploadAsset(order.orderId,order.uploadToken,'inside',insideBlob)]);",
  "const printSheet=await renderProdigiSheetBlob(front,inside,d);\n    button.textContent='SECURING YOUR MONSTER…';\n    await Promise.all([uploadAsset(order.orderId,order.uploadToken,'outside',printSheet),uploadAsset(order.orderId,order.uploadToken,'inside',printSheet)]);",
  'single-sheet checkout artwork'
);

const appEndMarker = 'loadConfig();';
const appEndReplacement = `const miniCart=$('.mini-cart');\nif(miniCart)miniCart.addEventListener('click',e=>{e.preventDefault();renderBasket()});\nupdateBasketCount();\n\n${appEndMarker}`;
if (!app.includes("miniCart.addEventListener('click'")) {
  app = mustReplace(app, appEndMarker, appEndReplacement, 'basket launcher');
}

fs.writeFileSync(appPath, app);

// ---------------------------------------------------------------------------
// Worker: permanently preserve the browser/API fix that was deployed manually.
// ---------------------------------------------------------------------------
const workerPath = 'src/index.js';
let worker = fs.readFileSync(workerPath, 'utf8');

if (!worker.includes('const API_CORS_HEADERS')) {
  const ttl = worker.match(/(?:const|var) DESIGN_TTL_SECONDS\s*=\s*[^;]+;/)?.[0];
  if (!ttl) throw new Error('Could not locate DESIGN_TTL_SECONDS');
  worker = worker.replace(ttl, `${ttl}\nconst API_CORS_HEADERS = {\n  "access-control-allow-origin": "*",\n  "access-control-allow-methods": "GET,POST,PUT,OPTIONS",\n  "access-control-allow-headers": "content-type,x-order-token,stripe-signature,authorization",\n  "access-control-max-age": "86400"\n};`);
}

if (!worker.includes('...API_CORS_HEADERS')) {
  worker = worker.replace(
    '"x-content-type-options": "nosniff",',
    '"x-content-type-options": "nosniff",\n      ...API_CORS_HEADERS,'
  );
}

const redirectStart = worker.indexOf('function redirectHostIfNeeded(request) {');
if (redirectStart < 0) throw new Error('redirectHostIfNeeded not found');
const defaultMarker = worker.indexOf('\nexport default {', redirectStart);
const bundledMarker = worker.indexOf('\nvar index_default = {', redirectStart);
const redirectEnd = [defaultMarker,bundledMarker].filter(x=>x>=0).sort((a,b)=>a-b)[0];
if (redirectEnd == null) throw new Error('Worker default export marker not found');
const safeRedirectBlock = `function redirectHostIfNeeded(request) {\n  const url = new URL(request.url);\n  if (url.pathname.startsWith("/api/")) return null;\n  if (request.method !== "GET" && request.method !== "HEAD") return null;\n  const host = url.hostname.toLowerCase();\n  if (host === "builttooffend.co.uk" || host === "www.builttooffend.co.uk" || host === "www.builttooffend.com") {\n    url.protocol = "https:";\n    url.hostname = "builttooffend.com";\n    return Response.redirect(url.toString(), 308);\n  }\n  return null;\n}`;
worker = worker.slice(0, redirectStart) + safeRedirectBlock + worker.slice(redirectEnd);

if (!worker.includes('request.method === "OPTIONS" && url.pathname.startsWith("/api/")')) {
  const exportPos = worker.indexOf('export default {');
  const bundledPos = worker.indexOf('var index_default = {');
  const mainPos = [exportPos,bundledPos].filter(x=>x>=0).sort((a,b)=>a-b)[0];
  const urlMarker = '    const url = new URL(request.url);\n';
  const urlPos = worker.indexOf(urlMarker, mainPos);
  if (urlPos < 0) throw new Error('Main Worker URL marker not found');
  const insertion = `    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {\n      return new Response(null, { status: 204, headers: API_CORS_HEADERS });\n    }\n`;
  worker = worker.slice(0, urlPos + urlMarker.length) + insertion + worker.slice(urlPos + urlMarker.length);
}

worker = worker.replace(
  /return env\.ASSETS\.fetch\(request\);/g,
  'if (env.ASSETS && typeof env.ASSETS.fetch === "function") return env.ASSETS.fetch(request);\n      return json({ error: "Site assets are unavailable." }, 503);'
);

fs.writeFileSync(workerPath, worker);
console.log('Built To Offend runtime fixed: basket + Prodigi single-sheet artwork + API hardening applied.');
