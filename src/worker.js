import worker, { BtoOrderStore as LegacyBtoOrderStore } from "./index.js";
import { DurableObject } from "cloudflare:workers";
import { handleBtoProdigiSpreadBridge } from "./bto-prodigi-spread-bridge.js";

const BTO_PUBLIC_BASE = "https://builttooffend.com";
const BTO_PRODIGI_ORDER_URL = "https://vermalio.stace-walbridge.workers.dev/api/internal/bto/prodigi/order";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return [...value].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseShipping(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function retryBtoFulfilment(env, limit = 8) {
  if (!env.BTO_DB) return { checked: 0, submitted: 0, failed: 0, unavailable: true };

  // Avoid hammering a provider during an outage while still recovering failed paid
  // orders automatically. Successful Prodigi submissions are idempotent by order ID.
  const retryBefore = new Date(Date.now() - 60 * 1000).toISOString();
  const query = await env.BTO_DB.prepare(
    "SELECT * FROM orders WHERE status IN ('paid','fulfilment_retry') AND (updated_at IS NULL OR updated_at < ?) ORDER BY updated_at ASC LIMIT ?"
  ).bind(retryBefore, limit).all();
  const rows = Array.isArray(query?.results) ? query.results : [];

  let submitted = 0;
  let failed = 0;

  for (const order of rows) {
    const orderId = String(order?.id || "");
    if (!orderId) continue;

    try {
      if (!order.outside_asset_key || !order.inside_asset_key) {
        throw new Error("Paid order is missing print artwork");
      }

      const token = randomToken(32);
      const hash = await sha256Hex(token);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      await env.BTO_DB.prepare(
        "UPDATE orders SET print_token_hash=?, print_token_expires_at=?, updated_at=? WHERE id=?"
      ).bind(hash, expires, now, orderId).run();

      const assetUrl = (kind) => `${BTO_PUBLIC_BASE}/api/print-asset/${encodeURIComponent(orderId)}/${kind}?token=${encodeURIComponent(token)}`;
      const body = {
        prodigiEnv: "live",
        sku: "GLOBAL-GRE-MOH-7X5-DIR",
        shippingMethod: "Budget",
        order: {
          id: orderId,
          brutality: order.brutality,
          pricePence: order.price_pence,
          shippingPence: order.shipping_pence,
          customerEmail: order.customer_email,
          shipping: parseShipping(order.shipping_json),
        },
        outsideUrl: assetUrl("outside"),
        insideUrl: assetUrl("inside"),
      };

      const request = new Request(BTO_PRODIGI_ORDER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const response = await handleBtoProdigiSpreadBridge(request, env, new URL(BTO_PRODIGI_ORDER_URL));
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.providerOrderId) {
        throw new Error(result?.error || `Prodigi bridge failed (${response.status})`);
      }

      await env.BTO_DB.prepare(
        "UPDATE orders SET status='submitted', printer_provider='prodigi', printer_order_id=?, last_error=NULL, updated_at=? WHERE id=?"
      ).bind(String(result.providerOrderId), new Date().toISOString(), orderId).run();
      submitted += 1;
    } catch (error) {
      failed += 1;
      const message = String(error?.message || error).slice(0, 900);
      console.error(JSON.stringify({ event: "bto_automatic_fulfilment_retry_failed", orderId, message }));
      await env.BTO_DB.prepare(
        "UPDATE orders SET status='fulfilment_retry', printer_provider='prodigi', last_error=?, updated_at=? WHERE id=?"
      ).bind(message, new Date().toISOString(), orderId).run().catch(() => {});
    }
  }

  if (rows.length) {
    console.log(JSON.stringify({ event: "bto_automatic_fulfilment_retry", checked: rows.length, submitted, failed }));
  }
  return { checked: rows.length, submitted, failed };
}

async function prodigiProviderStats(env) {
  const apiKey = env.PRODIGI_LIVE_API_KEY || env.PRODIGI_API_KEY || env.PRODIGI_KEY;
  if (!apiKey) {
    return json({ ok: false, apiKeyConfigured: false, error: "prodigi_api_key_unavailable" }, 503);
  }

  const createdFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endpoint = new URL("https://api.prodigi.com/v4.0/orders");
  endpoint.searchParams.set("top", "20");
  endpoint.searchParams.set("createdFrom", createdFrom);

  const response = await fetch(endpoint, {
    headers: {
      "X-API-Key": apiKey,
      accept: "application/json",
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    console.error("Prodigi provider stats request failed", response.status);
    return json({
      ok: false,
      apiKeyConfigured: true,
      providerHttpStatus: response.status,
      error: "prodigi_provider_check_failed",
    }, 502);
  }

  const orders = Array.isArray(payload?.orders) ? payload.orders : [];
  const safeOrders = orders
    .map((order) => ({
      created: order?.created || null,
      lastUpdated: order?.lastUpdated || null,
      stage: order?.status?.stage || null,
      issueCount: Array.isArray(order?.status?.issues) ? order.status.issues.length : 0,
    }))
    .sort((a, b) => Date.parse(b.created || "") - Date.parse(a.created || ""));

  return json({
    ok: true,
    apiKeyConfigured: true,
    windowHours: 24,
    orderCount: orders.length,
    hasMore: Boolean(payload?.hasMore),
    latest: safeOrders[0] || null,
  });
}

export class BtoOrderStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.delegate = new LegacyBtoOrderStore(ctx, env);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/stats") {
      const orders = await this.ctx.storage.list({ prefix: "order:" });
      let latest = null;

      for (const record of orders.values()) {
        if (!record || typeof record !== "object") continue;
        const updatedAt = record.updatedAt || record.eventTime || null;
        if (!latest || Date.parse(updatedAt || "") > Date.parse(latest.updatedAt || "")) {
          latest = {
            status: record.customerStatus || null,
            prodigiStage: record.prodigiStage || null,
            updatedAt,
          };
        }
      }

      return json({
        ok: true,
        orderCount: orders.size,
        latest,
      });
    }

    return this.delegate.fetch(request);
  }
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(retryBtoFulfilment(env).catch((error) => {
      console.error(JSON.stringify({ event: "bto_scheduled_retry_failed", message: String(error?.message || error) }));
    }));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/internal/bto/prodigi/")) {
      return handleBtoProdigiSpreadBridge(request, env, url);
    }

    if (request.method === "GET" && url.pathname === "/api/prodigi/webhook/stats") {
      try {
        const id = env.BTO_ORDER_STORE.idFromName("built-to-offend-orders");
        const store = env.BTO_ORDER_STORE.get(id);
        return await store.fetch("https://bto.internal/stats");
      } catch (error) {
        console.error("BTO order stats failed", error);
        return json({ ok: false, error: "order_stats_unavailable" }, 503);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/prodigi/provider-stats") {
      try {
        await retryBtoFulfilment(env);
        return await prodigiProviderStats(env);
      } catch (error) {
        console.error("Prodigi provider stats failed", error);
        return json({ ok: false, error: "prodigi_provider_check_unavailable" }, 503);
      }
    }

    return worker.fetch(request, env, ctx);
  },
};
