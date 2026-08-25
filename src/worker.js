import worker, { BtoOrderStore as LegacyBtoOrderStore } from "./index.js";
import { DurableObject } from "cloudflare:workers";
import { handleBtoProdigiSpreadBridge } from "./bto-prodigi-spread-bridge.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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
        return await prodigiProviderStats(env);
      } catch (error) {
        console.error("Prodigi provider stats failed", error);
        return json({ ok: false, error: "prodigi_provider_check_unavailable" }, 503);
      }
    }

    return worker.fetch(request, env, ctx);
  },
};
