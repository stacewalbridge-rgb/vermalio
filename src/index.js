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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/prodigi/webhook/health") {
      if (request.method !== "GET") {
        return json({ ok: false, error: "method_not_allowed" }, 405);
      }
      return json({ ok: true, service: "prodigi-webhook", mode: "receiver" });
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

      const orderId =
        event.subject ||
        event?.data?.id ||
        null;
      const stage = event?.data?.status?.stage || null;
      const shipments = Array.isArray(event?.data?.shipments)
        ? event.data.shipments.map((shipment) => ({
            id: shipment?.id || null,
            carrier: shipment?.carrier?.name || shipment?.carrier || null,
            trackingNumber: shipment?.tracking?.number || null,
            trackingUrl: shipment?.tracking?.url || null,
          }))
        : [];

      console.log(
        JSON.stringify({
          source: "prodigi",
          eventId: event.id,
          type: event.type,
          orderId,
          stage,
          shipments,
          receivedAt: new Date().toISOString(),
        })
      );

      // Acknowledge quickly so Prodigi does not retry a valid callback.
      // Persistence/status-sync can be added once the Built To Offend order store is connected.
      return new Response(null, { status: 204 });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
