const PRODIGI_SOURCE_HOSTS = new Set([
  "api.sandbox.prodigi.com",
  "api.prodigi.com",
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function isProdigiCloudEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (event.specversion !== "1.0") return false;
  if (typeof event.id !== "string" || !event.id.startsWith("evt_")) return false;
  if (typeof event.type !== "string" || !event.type.startsWith("com.prodigi.")) return false;
  if (typeof event.source !== "string") return false;

  try {
    const source = new URL(event.source);
    return source.protocol === "https:" && PRODIGI_SOURCE_HOSTS.has(source.hostname);
  } catch {
    return false;
  }
}

function getProdigiOrder(event) {
  const candidate = event?.data?.order || event?.data || null;
  return candidate && typeof candidate === "object" ? candidate : null;
}

function normalizeShipment(shipment) {
  const carrier = shipment?.carrier;
  const tracking = shipment?.tracking;

  return {
    id: shipment?.id || null,
    carrier:
      (carrier && typeof carrier === "object" ? carrier.name : carrier) ||
      shipment?.carrierName ||
      null,
    service:
      shipment?.service?.name ||
      shipment?.service ||
      shipment?.shippingMethod ||
      null,
    trackingNumber:
      (tracking && typeof tracking === "object" ? tracking.number : null) ||
      shipment?.trackingNumber ||
      null,
    trackingUrl:
      (tracking && typeof tracking === "object" ? tracking.url : null) ||
      shipment?.trackingUrl ||
      null,
    shippedAt:
      shipment?.shippedAt ||
      shipment?.dispatchDate ||
      shipment?.created ||
      null,
  };
}

function getShipments(order) {
  return Array.isArray(order?.shipments)
    ? order.shipments.map(normalizeShipment)
    : [];
}

function customerStatusFor(order) {
  const stage = String(order?.status?.stage || "").toLowerCase();
  const details = order?.status?.details || {};
  const inProduction = String(details.inProduction || "").toLowerCase();
  const shipping = String(details.shipping || "").toLowerCase();
  const shipments = getShipments(order);

  if (stage === "cancelled") return "cancelled";

  // Prodigi's Complete stage means all shipments have been sent, not delivered
  // to the recipient, so the customer-facing state remains shipped/dispatched.
  if (shipments.length > 0 || shipping === "complete" || stage === "complete") {
    return "shipped";
  }

  if (inProduction === "inprogress" || inProduction === "complete") {
    return "in_production";
  }

  if (stage === "inprogress") return "processing";
  return "received";
}

function publicOrderView(record) {
  return {
    ok: true,
    reference: record.reference,
    prodigiOrderId: record.prodigiOrderId,
    status: record.customerStatus,
    prodigiStage: record.prodigiStage,
    productionStatus: record.productionStatus,
    shippingStatus: record.shippingStatus,
    shipments: record.shipments,
    eventType: record.eventType,
    eventTime: record.eventTime,
    updatedAt: record.updatedAt,
  };
}

function getOrderStore(env) {
  const id = env.BTO_ORDER_STORE.idFromName("built-to-offend-orders");
  return env.BTO_ORDER_STORE.get(id);
}

export class BtoOrderStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, storage: "durable-object-sqlite" });
    }

    if (request.method === "POST" && url.pathname === "/ingest") {
      let incoming;
      try {
        incoming = await request.json();
      } catch {
        return json({ ok: false, error: "invalid_json" }, 400);
      }

      if (!incoming?.eventId || !incoming?.reference || !incoming?.prodigiOrderId) {
        return json({ ok: false, error: "missing_order_identity" }, 400);
      }

      const eventKey = `event:${incoming.eventId}`;
      const alreadySeen = await this.ctx.storage.get(eventKey);
      if (alreadySeen) {
        return json({ ok: true, duplicate: true, reference: incoming.reference });
      }

      const orderKey = `order:${incoming.reference}`;
      const existing = await this.ctx.storage.get(orderKey);
      const existingEventMs = Date.parse(existing?.eventTime || "");
      const incomingEventMs = Date.parse(incoming.eventTime || "");

      // Prodigi callbacks are queued and can arrive out of order. Keep the
      // newest known order state while still recording the event as received.
      if (
        existing &&
        Number.isFinite(existingEventMs) &&
        Number.isFinite(incomingEventMs) &&
        incomingEventMs < existingEventMs
      ) {
        await this.ctx.storage.put(eventKey, {
          receivedAt: new Date().toISOString(),
          ignoredAsOlderThan: existing.eventTime,
        });
        return json({
          ok: true,
          ignoredOlderEvent: true,
          reference: incoming.reference,
        });
      }

      const now = new Date().toISOString();
      const record = {
        ...incoming,
        firstSeenAt: existing?.firstSeenAt || now,
        updatedAt: now,
      };

      await this.ctx.storage.put(orderKey, record);
      await this.ctx.storage.put(`prodigi:${incoming.prodigiOrderId}`, incoming.reference);
      await this.ctx.storage.put(eventKey, { receivedAt: now });

      return json({ ok: true, reference: incoming.reference });
    }

    if (request.method === "GET" && url.pathname.startsWith("/order/")) {
      const reference = decodeURIComponent(url.pathname.slice("/order/".length));
      if (!reference) return json({ ok: false, error: "reference_required" }, 400);

      const record = await this.ctx.storage.get(`order:${reference}`);
      if (!record) return json({ ok: false, error: "order_not_found" }, 404);
      return json(record);
    }

    if (request.method === "GET" && url.pathname.startsWith("/prodigi/")) {
      const prodigiOrderId = decodeURIComponent(url.pathname.slice("/prodigi/".length));
      if (!prodigiOrderId) {
        return json({ ok: false, error: "prodigi_order_id_required" }, 400);
      }

      const reference = await this.ctx.storage.get(`prodigi:${prodigiOrderId}`);
      if (!reference) return json({ ok: false, error: "order_not_found" }, 404);

      const record = await this.ctx.storage.get(`order:${reference}`);
      if (!record) return json({ ok: false, error: "order_not_found" }, 404);
      return json(record);
    }

    return json({ ok: false, error: "not_found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/prodigi/webhook/health") {
      if (request.method !== "GET") {
        return json({ ok: false, error: "method_not_allowed" }, 405);
      }

      try {
        const store = getOrderStore(env);
        const storageHealth = await store.fetch("https://bto.internal/health");
        if (!storageHealth.ok) {
          return json({ ok: false, service: "prodigi-webhook", storage: "error" }, 503);
        }
        return json({
          ok: true,
          service: "prodigi-webhook",
          mode: "receiver-and-order-sync",
          storage: "durable-object-sqlite",
        });
      } catch (error) {
        console.error("BTO order store health check failed", error);
        return json({ ok: false, service: "prodigi-webhook", storage: "unavailable" }, 503);
      }
    }

    if (url.pathname === "/api/prodigi/webhook") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "method_not_allowed" }, 405);
      }

      const contentType = request.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("json")) {
        return json({ ok: false, error: "json_required" }, 415);
      }

      const contentLength = Number(request.headers.get("content-length") || "0");
      if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) {
        return json({ ok: false, error: "payload_too_large" }, 413);
      }

      let event;
      try {
        event = await request.json();
      } catch {
        return json({ ok: false, error: "invalid_json" }, 400);
      }

      if (!isProdigiCloudEvent(event)) {
        return json({ ok: false, error: "invalid_prodigi_event" }, 400);
      }

      const order = getProdigiOrder(event);
      if (!order) {
        return json({ ok: false, error: "missing_order_data" }, 400);
      }

      const prodigiOrderId = order.id || event.subject || null;
      const reference = order.merchantReference || prodigiOrderId;
      const prodigiStage = order?.status?.stage || null;
      const productionStatus = order?.status?.details?.inProduction || null;
      const shippingStatus = order?.status?.details?.shipping || null;
      const shipments = getShipments(order);
      const customerStatus = customerStatusFor(order);

      if (!prodigiOrderId || !reference) {
        return json({ ok: false, error: "missing_order_identity" }, 400);
      }

      const record = {
        source: "prodigi",
        eventId: event.id,
        eventType: event.type,
        eventTime: event.time || new Date().toISOString(),
        reference,
        prodigiOrderId,
        prodigiStage,
        productionStatus,
        shippingStatus,
        customerStatus,
        shipments,
      };

      try {
        const store = getOrderStore(env);
        const saved = await store.fetch("https://bto.internal/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record),
        });

        if (!saved.ok) {
          console.error("BTO order status persistence failed", await saved.text());
          // A non-2xx response asks Prodigi to retry rather than silently losing
          // the order update.
          return json({ ok: false, error: "order_status_persistence_failed" }, 503);
        }
      } catch (error) {
        console.error("BTO order status persistence failed", error);
        return json({ ok: false, error: "order_status_persistence_failed" }, 503);
      }

      console.log(
        `BTO ${reference} | ${customerStatus} | ${prodigiOrderId} | ${event.id}`
      );

      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith("/api/bto/orders/")) {
      if (request.method !== "GET") {
        return json({ ok: false, error: "method_not_allowed" }, 405);
      }

      const reference = decodeURIComponent(url.pathname.slice("/api/bto/orders/".length));
      if (!reference) return json({ ok: false, error: "reference_required" }, 400);

      try {
        const store = getOrderStore(env);
        const response = await store.fetch(
          `https://bto.internal/order/${encodeURIComponent(reference)}`
        );
        if (response.status === 404) {
          return json({ ok: false, error: "order_not_found" }, 404);
        }
        if (!response.ok) {
          return json({ ok: false, error: "order_store_error" }, 503);
        }

        const record = await response.json();
        return json(publicOrderView(record));
      } catch (error) {
        console.error("BTO order status lookup failed", error);
        return json({ ok: false, error: "order_store_unavailable" }, 503);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
