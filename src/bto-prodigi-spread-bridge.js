import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PRODIGI_BASE = "https://api.prodigi.com";
const DEFAULT_SKU = "GLOBAL-GRE-MOH-7X5-DIR";
const CALLBACK_URL = "https://vermalio.stace-walbridge.workers.dev/api/prodigi/webhook";
const ARTWORK_BASE = "https://vermalio.stace-walbridge.workers.dev/api/internal/bto/prodigi/artwork";
const SPREAD_WIDTH_PX = 6118;
const SPREAD_HEIGHT_PX = 2161;
const PRINT_DPI = 300;
const PDF_WIDTH = (SPREAD_WIDTH_PX / PRINT_DPI) * 72;
const PDF_HEIGHT = (SPREAD_HEIGHT_PX / PRINT_DPI) * 72;
const SPREAD_TTL_SECONDS = 24 * 60 * 60;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 24 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseBtoAssetUrl(value) {
  try {
    const u = new URL(String(value || ""));
    if (u.protocol !== "https:" || u.hostname !== "builttooffend.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 4 || parts[0] !== "api" || parts[1] !== "print-asset") return null;
    if (!u.searchParams.get("token")) return null;
    return {
      url: u,
      orderId: decodeURIComponent(parts[2] || ""),
      kind: decodeURIComponent(parts[3] || ""),
    };
  } catch {
    return null;
  }
}

function parseArtworkToken(url) {
  const prefix = "/api/internal/bto/prodigi/artwork/";
  if (!url.pathname.startsWith(prefix)) return null;
  const tail = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!/^[0-9a-f]{32,64}\.pdf$/i.test(tail)) return null;
  return tail;
}

async function bearerAuthorized(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !env.BTO_PRODIGI_PROXY_TOKEN_HASH) return false;
  return timingSafeEqual(await sha256Hex(token), String(env.BTO_PRODIGI_PROXY_TOKEN_HASH));
}

function capabilityUrlsMatch(order, outsideUrl, insideUrl) {
  const outside = parseBtoAssetUrl(outsideUrl);
  const inside = parseBtoAssetUrl(insideUrl);
  const orderId = String(order?.id || "");
  return Boolean(
    orderId &&
    outside &&
    inside &&
    outside.orderId === orderId &&
    inside.orderId === orderId &&
    outside.kind === "outside" &&
    inside.kind === "inside"
  );
}

async function fetchSourceImage(value) {
  const parsed = parseBtoAssetUrl(value);
  if (!parsed) throw new Error("Invalid Built To Offend print artwork URL");
  const response = await fetch(parsed.url.toString(), {
    method: "GET",
    headers: { accept: "image/png,image/jpeg" },
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`Built To Offend artwork fetch failed (${response.status})`);
  const length = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) throw new Error("Print artwork is too large");
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!(contentType.includes("image/png") || contentType.includes("image/jpeg"))) {
    throw new Error("Built To Offend artwork is not PNG or JPEG");
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Print artwork is too large");
  return { bytes, contentType };
}

async function embedImage(pdf, source) {
  if (source.contentType.includes("jpeg")) return pdf.embedJpg(source.bytes);
  return pdf.embedPng(source.bytes);
}

function panelPointX(pixelX) {
  return (pixelX / SPREAD_WIDTH_PX) * PDF_WIDTH;
}

async function createFourPanelPdf(outsideUrl, insideUrl) {
  const [outsideSource, insideSource] = await Promise.all([
    fetchSourceImage(outsideUrl),
    fetchSourceImage(insideUrl),
  ]);

  const pdf = await PDFDocument.create();
  pdf.setTitle("Built To Offend personalised greeting card");
  pdf.setCreator("Built To Offend");
  pdf.setProducer("Built To Offend / Vermalio");

  const page = pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PDF_WIDTH, height: PDF_HEIGHT, color: rgb(0.961, 0.941, 0.890) });

  const outsideImage = await embedImage(pdf, outsideSource);
  const insideImage = await embedImage(pdf, insideSource);
  const cuts = [0, 1529, 3059, 4588, 6118];

  const drawPanel = (image, leftPx, rightPx) => {
    const x = panelPointX(leftPx);
    const width = panelPointX(rightPx) - x;
    page.drawImage(image, { x, y: 0, width, height: PDF_HEIGHT });
  };

  // Prodigi's 7x5 direct greeting-card template is one landscape spread:
  // back cover | front cover | inside-left | inside-right.
  drawPanel(outsideImage, cuts[1], cuts[2]);
  drawPanel(insideImage, cuts[3], cuts[4]);

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const backLeft = panelPointX(cuts[0]);
  const backRight = panelPointX(cuts[1]);
  const backCentre = (backLeft + backRight) / 2;
  const title = "BUILT TO OFFEND";
  const site = "builttooffend.com";
  const titleSize = 18;
  const siteSize = 10;
  page.drawText(title, {
    x: backCentre - bold.widthOfTextAtSize(title, titleSize) / 2,
    y: 48,
    size: titleSize,
    font: bold,
    color: rgb(0.09, 0.09, 0.09),
  });
  page.drawText(site, {
    x: backCentre - regular.widthOfTextAtSize(site, siteSize) / 2,
    y: 29,
    size: siteSize,
    font: regular,
    color: rgb(0.40, 0.38, 0.42),
  });

  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  if (!bytes.byteLength || bytes.byteLength > MAX_PDF_BYTES) throw new Error("Combined Prodigi print spread is too large");
  return bytes;
}

async function storeSpread(env, pdfBytes) {
  if (!env.BTO_PRINT_SPREADS) throw new Error("Prodigi print-spread storage is unavailable");
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const key = `prodigi-spreads/${token}.pdf`;
  const exact = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
  await env.BTO_PRINT_SPREADS.put(key, exact, {
    expirationTtl: SPREAD_TTL_SECONDS,
    metadata: { contentType: "application/pdf", purpose: "prodigi-greeting-card-spread" },
  });
  return `${ARTWORK_BASE}/${token}.pdf`;
}

async function serveSpread(env, url) {
  if (!env.BTO_PRINT_SPREADS) return new Response("Storage unavailable", { status: 503 });
  const tokenFile = parseArtworkToken(url);
  if (!tokenFile) return new Response("Not found", { status: 404 });
  const object = await env.BTO_PRINT_SPREADS.getWithMetadata(`prodigi-spreads/${tokenFile}`, "arrayBuffer");
  if (!object?.value) return new Response("Not found", { status: 404 });
  return new Response(object.value, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline; filename=print-spread.pdf",
    },
  });
}

async function productDetails(apiKey, sku) {
  const response = await fetch(`${PRODIGI_BASE}/v4.0/products/${encodeURIComponent(sku)}`, {
    headers: { "X-API-Key": apiKey },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || String(payload?.outcome || "").toLowerCase() !== "ok") {
    throw new Error(`Prodigi product lookup failed (${response.status})`);
  }
  return payload.product || payload;
}

function validateTemplate(product) {
  const size = product?.variants?.[0]?.printAreaSizes?.default;
  if (!product?.printAreas?.default || !size) throw new Error("Prodigi default print area is unavailable");
  if (Number(size.horizontalResolution) !== SPREAD_WIDTH_PX || Number(size.verticalResolution) !== SPREAD_HEIGHT_PX) {
    throw new Error(`Unexpected Prodigi template size ${size.horizontalResolution}x${size.verticalResolution}`);
  }
  return "default";
}

function recipientFrom(order) {
  const shipping = order?.shipping || {};
  const address = shipping.address || {};
  const country = String(address.country || "").toUpperCase();
  if (country !== "GB") throw new Error("Built To Offend currently accepts UK delivery only");
  if (!shipping.name || !address.line1 || !address.postal_code || !address.city) {
    throw new Error("Paid order is missing a complete UK delivery address");
  }
  return {
    name: String(shipping.name).trim(),
    email: order.customerEmail ? String(order.customerEmail).trim() : undefined,
    address: {
      line1: String(address.line1).trim(),
      line2: address.line2 ? String(address.line2).trim() : undefined,
      postalOrZipCode: String(address.postal_code).trim(),
      countryCode: country,
      townOrCity: String(address.city).trim(),
      stateOrCounty: address.state ? String(address.state).trim() : undefined,
    },
  };
}

function verifyCreated(result, status) {
  const outcome = String(result?.outcome || "").toLowerCase();
  const allowed = new Set(["created", "onhold", "alreadyexists"]);
  const providerOrderId = result?.order?.id || result?.id || null;
  const issues = Array.isArray(result?.order?.status?.issues) ? result.order.status.issues : [];
  if (!allowed.has(outcome) || !providerOrderId || issues.length) {
    const issueText = issues.length
      ? `; ${issues.map((x) => x?.description || x?.code || JSON.stringify(x)).join(" | ")}`
      : "";
    throw new Error(`Prodigi order rejected (${status}): ${result?.outcome || result?.error || "unknown"}${issueText}`);
  }
  return providerOrderId;
}

export async function handleBtoProdigiSpreadBridge(request, env, url) {
  if (request.method === "GET" && url.pathname.startsWith("/api/internal/bto/prodigi/artwork/")) {
    return serveSpread(env, url);
  }

  const apiKey = env.PRODIGI_LIVE_API_KEY || env.PRODIGI_API_KEY || env.PRODIGI_KEY;
  if (!apiKey) return json({ ok: false, error: "prodigi_live_runtime_secret_missing" }, 503);

  try {
    if (request.method === "GET" && url.pathname.endsWith("/health")) {
      const product = await productDetails(apiKey, url.searchParams.get("sku") || DEFAULT_SKU);
      validateTemplate(product);
      if (!env.BTO_PRINT_SPREADS) return json({ ok: false, error: "prodigi_spread_storage_missing" }, 503);
      return json({
        ok: true,
        provider: "prodigi",
        environment: "live",
        sku: url.searchParams.get("sku") || DEFAULT_SKU,
        printArea: "default",
        horizontalResolution: SPREAD_WIDTH_PX,
        verticalResolution: SPREAD_HEIGHT_PX,
        spreadMode: "four-panel-pdf",
        storage: "workers-kv",
      });
    }

    if (request.method !== "POST" || !url.pathname.endsWith("/order")) {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    const body = await request.json();
    const order = body?.order || {};
    if (!order.id) throw new Error("Missing merchant order reference");

    const bearerOk = await bearerAuthorized(request, env);
    const capabilityOk = capabilityUrlsMatch(order, body?.outsideUrl, body?.insideUrl);
    if (!bearerOk && !capabilityOk) return json({ ok: false, error: "forbidden" }, 403);
    if (!capabilityUrlsMatch(order, body?.outsideUrl, body?.insideUrl)) {
      throw new Error("Built To Offend outside/inside artwork capability URLs do not match this order");
    }

    const sku = String(body?.sku || DEFAULT_SKU).trim();
    const product = await productDetails(apiKey, sku);
    const printArea = validateTemplate(product);
    const spreadPdf = await createFourPanelPdf(body.outsideUrl, body.insideUrl);
    const spreadUrl = await storeSpread(env, spreadPdf);
    const totalPence = Number(order.pricePence || 0) + Number(order.shippingPence || 0);

    const payload = {
      merchantReference: String(order.id),
      idempotencyKey: String(order.id),
      callbackUrl: CALLBACK_URL,
      shippingMethod: String(body?.shippingMethod || "Budget"),
      recipient: recipientFrom(order),
      items: [{
        merchantReference: `monster-${order.id}`,
        sku,
        copies: 1,
        sizing: "fillPrintArea",
        recipientCost: {
          amount: (Math.max(0, totalPence) / 100).toFixed(2),
          currency: "GBP",
        },
        assets: [{ printArea, url: spreadUrl }],
      }],
      metadata: {
        source: "builttooffend.com",
        brutality: String(order.brutality || ""),
        printLayout: "four-panel-pdf-6118x2161",
      },
    };

    const response = await fetch(`${PRODIGI_BASE}/v4.0/orders`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Prodigi order failed (${response.status}): ${result?.outcome || result?.error || "unknown"}`);
    }

    const providerOrderId = verifyCreated(result, response.status);
    return json({
      ok: true,
      provider: "prodigi",
      environment: "live",
      providerOrderId,
      outcome: result.outcome,
      printArea,
      spreadMode: "four-panel-pdf",
    });
  } catch (error) {
    console.error("BTO Prodigi spread bridge", String(error?.message || error));
    return json({ ok: false, error: String(error?.message || error) }, 502);
  }
}
