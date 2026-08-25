import worker, { BtoOrderStore as LegacyBtoOrderStore } from "./index.js";
import { DurableObject } from "cloudflare:workers";

export class BtoOrderStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.delegate = new LegacyBtoOrderStore(ctx, env);
  }

  fetch(request) {
    return this.delegate.fetch(request);
  }
}

export default worker;
