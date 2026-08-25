import worker, { BtoOrderStore as LegacyBtoOrderStore } from "./index.js";
import { DurableObject } from "cloudflare:workers";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
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

    return worker.fetch(request, env, ctx);
  },
};
