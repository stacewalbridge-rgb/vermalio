const fs = require('fs');

function fail(message) {
  throw new Error(message);
}

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) fail(`Could not find ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) fail(`Found ${label} more than once`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

const appPath = 'public/app.js';
const workerPath = 'src/index.js';
let app = fs.readFileSync(appPath, 'utf8');
let worker = fs.readFileSync(workerPath, 'utf8');

const spreadRenderer = `
async function renderProdigiSpreadBlob(front,inside,d){
  const [frontBlob,insideBlob]=await Promise.all([
    renderPrintBlob(front,inside,d,'outside'),
    renderPrintBlob(front,inside,d,'inside')
  ]);
  const frontUrl=URL.createObjectURL(frontBlob),insideUrl=URL.createObjectURL(insideBlob);
  try{
    const [frontImg,insideImg]=await Promise.all([loadImage(frontUrl),loadImage(insideUrl)]);
    const canvas=document.createElement('canvas');
    canvas.width=6118;canvas.height=2161;
    const ctx=canvas.getContext('2d');
    const cuts=[0,1529,3059,4588,6118];
    const cream='#f5f0e3';
    ctx.fillStyle=cream;ctx.fillRect(0,0,canvas.width,canvas.height);
    const drawCover=(img,x0,x1)=>{
      const w=x1-x0,h=canvas.height;
      const scale=Math.max(w/img.width,h/img.height);
      const dw=img.width*scale,dh=img.height*scale;
      ctx.drawImage(img,x0+(w-dw)/2,(h-dh)/2,dw,dh);
    };
    // Prodigi's 7x5 greeting-card template is one four-panel image:
    // back cover | front cover | inside-left | inside-right.
    drawCover(frontImg,cuts[1],cuts[2]);
    drawCover(insideImg,cuts[3],cuts[4]);

    ctx.fillStyle='#171717';ctx.textAlign='center';ctx.font='900 44px Arial';
    ctx.fillText('BUILT TO OFFEND',(cuts[0]+cuts[1])/2,canvas.height-210);
    ctx.fillStyle='#6d6872';ctx.font='600 24px Arial';
    ctx.fillText('builttooffend.com',(cuts[0]+cuts[1])/2,canvas.height-155);

    return await new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error('Could not render Prodigi print spread')),
      'image/jpeg',0.96
    ));
  }finally{
    URL.revokeObjectURL(frontUrl);URL.revokeObjectURL(insideUrl);
  }
}

`;

app = replaceOnce(
  app,
  "async function apiJson(path,options={})",
  spreadRenderer + "async function apiJson(path,options={})",
  'apiJson marker in public/app.js'
);

const oldCheckoutArt = `const [outside,insideBlob]=await Promise.all([renderPrintBlob(front,inside,d,'outside'),renderPrintBlob(front,inside,d,'inside')]);\n    button.textContent='SECURING YOUR MONSTER…';\n    await Promise.all([uploadAsset(order.orderId,order.uploadToken,'outside',outside),uploadAsset(order.orderId,order.uploadToken,'inside',insideBlob)]);`;
const newCheckoutArt = `const spread=await renderProdigiSpreadBlob(front,inside,d);\n    button.textContent='SECURING YOUR MONSTER…';\n    await uploadAsset(order.orderId,order.uploadToken,'outside',spread);`;
app = replaceOnce(app, oldCheckoutArt, newCheckoutArt, 'two-file checkout artwork block');

worker = replaceOnce(
  worker,
  `if (!order.outside_asset_key || !order.inside_asset_key) return json({ error: "Print artwork is still being prepared. Try again." }, 409);`,
  `if (!order.outside_asset_key) return json({ error: "Print artwork is still being prepared. Try again." }, 409);`,
  'checkout artwork readiness gate'
);

const submitStart = worker.indexOf('async function submitToProdigi(order, env) {');
const submitEnd = worker.indexOf('\nasync function fulfillOrder(orderId, env) {', submitStart);
if (submitStart < 0 || submitEnd < 0) fail('Could not locate submitToProdigi function');

const newSubmit = `async function submitToProdigi(order, env) {
  if (env.PRODIGI_PROXY_URL) return submitViaProdigiProxy(order, env);
  if (!env.PRODIGI_API_KEY) throw new Error("Prodigi API key is not configured");
  const { outsideUrl } = await createPrintAssetUrls(order.id, env);
  const product = await prodigiProductDetails(env);
  const areas = extractPrintAreas(product);
  const printArea = areas.find((x) => /^default$/i.test(x)) || areas[0];
  if (!printArea) throw new Error("Could not determine Prodigi greeting-card print area. Check the configured SKU.");

  const base = env.PRODIGI_ENV === "live" ? "https://api.prodigi.com" : "https://api.sandbox.prodigi.com";
  const recipient = JSON.parse(order.shipping_json || "{}");
  const country = String(recipient.address?.country || "").toUpperCase();
  if (country !== "GB") throw new Error("Built To Offend is currently accepting UK delivery only");
  if (!recipient.name || !recipient.address?.line1 || !recipient.address?.postal_code || !recipient.address?.city) {
    throw new Error("Paid order is missing a complete delivery address");
  }

  const payload = {
    merchantReference: order.id,
    idempotencyKey: order.id,
    shippingMethod: env.PRODIGI_SHIPPING_METHOD || "Budget",
    recipient: {
      name: recipient.name,
      email: order.customer_email || undefined,
      address: {
        line1: recipient.address.line1,
        line2: recipient.address.line2 || undefined,
        postalOrZipCode: recipient.address.postal_code,
        countryCode: country,
        townOrCity: recipient.address.city,
        stateOrCounty: recipient.address.state || undefined,
      },
    },
    items: [{
      merchantReference: \`monster-\${order.id}\`,
      sku: env.PRODIGI_SKU || "GLOBAL-GRE-MOH-7X5-DIR",
      copies: 1,
      sizing: "fillPrintArea",
      recipientCost: {
        amount: ((Number(order.price_pence || 0) + Number(order.shipping_pence || 0)) / 100).toFixed(2),
        currency: "GBP",
      },
      assets: [{ printArea, url: outsideUrl }],
    }],
    metadata: { source: "builttooffend.com", brutality: String(order.brutality || "") },
  };

  const response = await fetch(\`\${base}/v4.0/orders\`, {
    method: "POST",
    headers: { "X-API-Key": env.PRODIGI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(\`Prodigi order failed (\${response.status}): \${result?.outcome || result?.error || "unknown error"}\`);

  const outcome = String(result?.outcome || "").toLowerCase();
  const allowed = new Set(["created", "onhold", "alreadyexists"]);
  const providerOrderId = result?.order?.id || result?.id || null;
  const issues = Array.isArray(result?.order?.status?.issues) ? result.order.status.issues : [];
  if (!allowed.has(outcome) || !providerOrderId || issues.length) {
    const issueText = issues.length ? \`; \${issues.map((x) => x?.description || x?.code || JSON.stringify(x)).join(" | ")}\` : "";
    throw new Error(\`Prodigi order rejected: \${result?.outcome || result?.error || "unknown error"}\${issueText}\`);
  }
  return { providerOrderId, raw: result };
}`;

worker = worker.slice(0, submitStart) + newSubmit + worker.slice(submitEnd);

fs.writeFileSync(appPath, app);
fs.writeFileSync(workerPath, worker);
console.log('Applied Prodigi four-panel 6118x2161 spread mapping and single default print-area submission.');
