// © 2026 Vamalio Technologies. All rights reserved.
// Core domain logic for RecoveryFlow, DentalFlow and future capacity-recovery products.
// This module contains no vendor credentials and makes no independent clinical decisions.

export class CapacityRecoveryEngine {
  constructor({ sourceAdapter, communications, transportAdapter = null, now = () => new Date() } = {}) {
    this.sourceAdapter = sourceAdapter;
    this.communications = communications;
    this.transportAdapter = transportAdapter;
    this.now = now;
    this.events = new Map();
  }

  createRecoveryEvent(input) {
    const required = ["id", "trigger", "resourceId", "windowStart", "windowEnd"];
    for (const key of required) {
      if (!input?.[key]) throw new Error(`missing_${key}`);
    }

    const start = new Date(input.windowStart);
    const end = new Date(input.windowEnd);
    const detectedAt = input.detectedAt ? new Date(input.detectedAt) : this.now();
    const usableFrom = input.trigger === "no_show" && detectedAt > start ? detectedAt : start;
    const turnaroundMinutes = Math.max(0, Number(input.turnaroundMinutes || 0));
    const usableMinutes = Math.max(0, Math.floor((end - usableFrom) / 60000) - turnaroundMinutes);

    const event = {
      ...input,
      start,
      end,
      detectedAt,
      usableFrom,
      usableMinutes,
      status: "open",
      acceptedCandidateId: null,
      offers: [],
      audit: [{ at: this.now().toISOString(), type: "event_created", usableMinutes }],
    };

    this.events.set(event.id, event);
    return this.publicEvent(event);
  }

  async rankCandidates(eventId, sourceCandidates = null) {
    const event = this.requireOpenEvent(eventId);
    const candidates = sourceCandidates || await this.sourceAdapter.getCandidates(event);
    const ranked = [];

    for (const candidate of candidates || []) {
      const duration = Number(candidate.durationMinutes || 0);
      if (!candidate.sourceEligible) continue;
      if (!candidate.shortNoticeAllowed) continue;
      if (!duration || duration > event.usableMinutes) continue;
      if (!this.resourceAllows(event, candidate)) continue;

      const latestArrival = new Date(event.end.getTime() - duration * 60000);
      const arrival = await this.estimateArrival(event, candidate);
      if (!arrival || arrival > latestArrival) continue;

      let transport = { required: false, feasible: true };
      if (candidate.transportRequired) {
        transport = await this.checkTransport(event, candidate, latestArrival);
        if (!transport.feasible) continue;
      }

      ranked.push({
        ...candidate,
        durationMinutes: duration,
        latestArrival: latestArrival.toISOString(),
        estimatedArrival: arrival.toISOString(),
        transport,
        score: this.scoreCandidate(event, candidate, arrival, latestArrival),
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    event.audit.push({ at: this.now().toISOString(), type: "candidates_ranked", count: ranked.length });
    return ranked;
  }

  resourceAllows(event, candidate) {
    if (Array.isArray(candidate.allowedResourceIds) && !candidate.allowedResourceIds.includes(event.resourceId)) return false;
    if (Array.isArray(event.allowedActivityTypes) && event.allowedActivityTypes.length) {
      if (!event.allowedActivityTypes.includes(candidate.activityType)) return false;
    }
    return true;
  }

  async estimateArrival(event, candidate) {
    const travelMinutes = Number(candidate.travelMinutes);
    if (!Number.isFinite(travelMinutes)) return null;
    const preparation = Math.max(0, Number(candidate.preparationMinutes || 0));
    return new Date(this.now().getTime() + (travelMinutes + preparation) * 60000);
  }

  async checkTransport(event, candidate, latestArrival) {
    if (!this.transportAdapter) return { required: true, feasible: false, reason: "transport_adapter_unavailable" };
    return this.transportAdapter.checkFeasibility({ event, candidate, latestArrival });
  }

  scoreCandidate(event, candidate, arrival, latestArrival) {
    // Intentionally transparent baseline. Customer-specific scoring can be supplied
    // as configuration without changing the core engine.
    const urgency = Math.max(0, 100 - Number(candidate.priority || 50));
    const wait = Math.min(100, Number(candidate.waitDays || 0) / 4);
    const arrivalSlack = Math.max(0, (latestArrival - arrival) / 60000);
    const fit = Math.max(0, 100 - (event.usableMinutes - Number(candidate.durationMinutes || 0)));
    return urgency * 4 + wait * 2 + arrivalSlack + fit;
  }

  async offer(eventId, candidates, { responseSeconds = 120, channelPolicy = ["sms", "voice", "email"] } = {}) {
    const event = this.requireOpenEvent(eventId);
    const created = [];

    for (const candidate of candidates) {
      const channel = channelPolicy.find((c) => candidate.channels?.includes(c)) || candidate.channels?.[0];
      if (!channel) continue;
      const offer = {
        id: `${event.id}:${candidate.id}:${crypto.randomUUID()}`,
        candidateId: candidate.id,
        channel,
        status: "open",
        createdAt: this.now().toISOString(),
        expiresAt: new Date(this.now().getTime() + responseSeconds * 1000).toISOString(),
      };
      await this.communications.sendOffer({ event, candidate, offer });
      event.offers.push(offer);
      created.push(offer);
    }

    event.audit.push({ at: this.now().toISOString(), type: "offers_created", count: created.length });
    return created;
  }

  async accept(eventId, candidateId, metadata = {}) {
    const event = this.requireOpenEvent(eventId);
    // Production deployment must wrap this operation in transactional/atomic storage
    // (e.g. Durable Object transaction or database row lock) so only one acceptance wins.
    if (event.acceptedCandidateId) return { ok: false, reason: "already_filled", winner: event.acceptedCandidateId };

    const candidate = await this.sourceAdapter.getCandidate(event, candidateId);
    if (!candidate) return { ok: false, reason: "candidate_not_found" };

    event.acceptedCandidateId = candidateId;
    event.status = "recovered";
    for (const offer of event.offers) offer.status = offer.candidateId === candidateId ? "accepted" : "closed";

    const writeBack = await this.sourceAdapter.confirmBooking({ event, candidate, metadata });
    event.audit.push({ at: this.now().toISOString(), type: "accepted", candidateId, writeBack });

    return { ok: true, candidateId, writeBack, event: this.publicEvent(event) };
  }

  async decline(eventId, candidateId, metadata = {}) {
    const event = this.requireOpenEvent(eventId);
    for (const offer of event.offers) {
      if (offer.candidateId === candidateId && offer.status === "open") offer.status = "declined";
    }
    event.audit.push({ at: this.now().toISOString(), type: "declined", candidateId, metadata });
    return { ok: true };
  }

  requireOpenEvent(eventId) {
    const event = this.events.get(eventId);
    if (!event) throw new Error("event_not_found");
    if (event.status !== "open") throw new Error("event_not_open");
    return event;
  }

  publicEvent(event) {
    return {
      id: event.id,
      trigger: event.trigger,
      resourceId: event.resourceId,
      windowStart: event.start.toISOString(),
      windowEnd: event.end.toISOString(),
      usableFrom: event.usableFrom.toISOString(),
      usableMinutes: event.usableMinutes,
      status: event.status,
      acceptedCandidateId: event.acceptedCandidateId,
    };
  }
}

// Adapter contracts:
// sourceAdapter.getCandidates(event)
// sourceAdapter.getCandidate(event, candidateId)
// sourceAdapter.confirmBooking({ event, candidate, metadata })
// communications.sendOffer({ event, candidate, offer })
// transportAdapter.checkFeasibility({ event, candidate, latestArrival })
