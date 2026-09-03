const fs = require('fs');

function mustReplace(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Could not apply ${label}: marker not found`);
  return source.replace(before, after);
}

// Built To Offend mobile/network reliability hotfix.
// Keep the existing card rendering and Prodigi layout unchanged. Only harden
// browser API transport and non-canonical-host API handling.

const appPath = 'public/app.js';
let app = fs.readFileSync(appPath, 'utf8');

if (!app.includes('BTO_FETCH_RELIABILITY_V1')) {
  const oldApi = "async function apiJson(path,options={}){const r=await fetch(path,options);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||`Request failed (${r.status})`);return j}";
  const newApi = "const BTO_FETCH_RELIABILITY_V1=true;\nfunction btoWait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}\nasync function apiJson(path,options={}){\n  let r;\n  try{r=await fetch(path,options)}catch(cause){\n    const error=new Error('Connection dropped while contacting Built To Offend. Please try again.');\n    error.network=true;error.cause=cause;throw error;\n  }\n  let j={};try{j=await r.json()}catch{}\n  if(!r.ok){const error=new Error(j.error||('Request failed ('+r.status+')'));error.status=r.status;throw error}\n  return j\n}";
  app = mustReplace(app, oldApi, newApi, 'API transport diagnostics');

  const oldUpload = "async function uploadAsset(orderId,token,kind,blob){return apiJson(`/api/order-asset?order_id=${encodeURIComponent(orderId)}&kind=${encodeURIComponent(kind)}`,{method:'PUT',headers:{'content-type':'image/png','x-order-token':token},body:blob})}";
  const newUpload = "async function uploadAsset(orderId,token,kind,blob){\n  const path='/api/order-asset?order_id='+encodeURIComponent(orderId)+'&kind='+encodeURIComponent(kind);\n  let lastError;\n  for(let attempt=1;attempt<=3;attempt+=1){\n    try{return await apiJson(path,{method:'PUT',headers:{'content-type':blob.type||'image/png','x-order-token':token},body:blob})}\n    catch(error){\n      lastError=error;\n      const status=Number(error?.status||0);\n      const retryable=error?.network===true||status===408||status===425||status===429||status>=500;\n      if(!retryable||attempt===3)throw error;\n      await btoWait(attempt===1?650:1400);\n    }\n  }\n  throw lastError||new Error('Artwork upload failed');\n}";
  app = mustReplace(app, oldUpload, newUpload, 'artwork upload retry');

  const parallelUploads = "await Promise.all([uploadAsset(order.orderId,order.uploadToken,'outside',outside),uploadAsset(order.orderId,order.uploadToken,'inside',insideBlob)]);";
  const sequentialUploads = "await uploadAsset(order.orderId,order.uploadToken,'outside',outside);\n    await uploadAsset(order.orderId,order.uploadToken,'inside',insideBlob);";
  app = mustReplace(app, parallelUploads, sequentialUploads, 'sequential artwork upload');
}

fs.writeFileSync(appPath, app);

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
const safeRedirectBlock = `function redirectHostIfNeeded(request) {\n  const url = new URL(request.url);\n  // Never redirect API calls. Redirecting POST/PUT between host aliases can\n  // surface in browsers as a generic TypeError: Failed to fetch. Every alias\n  // is attached to this Worker, so serve API calls directly on the host used.\n  if (url.pathname.startsWith("/api/")) return null;\n  if (request.method !== "GET" && request.method !== "HEAD") return null;\n  const host = url.hostname.toLowerCase();\n  if (host === "builttooffend.co.uk" || host === "www.builttooffend.co.uk" || host === "www.builttooffend.com") {\n    url.protocol = "https:";\n    url.hostname = "builttooffend.com";\n    return Response.redirect(url.toString(), 308);\n  }\n  return null;\n}`;
worker = worker.slice(0, redirectStart) + safeRedirectBlock + worker.slice(redirectEnd);

if (!worker.includes('request.method === "OPTIONS" && url.pathname.startsWith("/api/")')) {
  const exportPos = worker.indexOf('export default {');
  const bundledPos = worker.indexOf('var index_default = {');
  const mainPos = [exportPos,bundledPos].filter(x=>x>=0).sort((a,b)=>a-b)[0];
  if (mainPos == null) throw new Error('Worker main export not found');
  const urlMarker = '    const url = new URL(request.url);\n';
  const urlPos = worker.indexOf(urlMarker, mainPos);
  if (urlPos < 0) throw new Error('Main Worker URL marker not found');
  const insertion = `    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {\n      return new Response(null, { status: 204, headers: API_CORS_HEADERS });\n    }\n`;
  worker = worker.slice(0, urlPos + urlMarker.length) + insertion + worker.slice(urlPos + urlMarker.length);
}

fs.writeFileSync(workerPath, worker);
console.log('BTO_FETCH_RELIABILITY_V1 applied: API alias hardening + sequential retrying artwork uploads.');
