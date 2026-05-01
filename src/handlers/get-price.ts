import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { PriceResult } from "../types.js";
import { PolymarketError } from "../types.js";
import { parseParams, StreamPricesParamsSchema, sanitizeTokenId } from "../validation.js";

export async function polyGetPrice(task: WorkerTask): Promise<unknown> {
  const params = parseParams(StreamPricesParamsSchema, task.params);
  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }
  const tokenId = sanitizeTokenId(params.token_id);

  const client = new PolymarketClient();
  const price = await client.getPrice(tokenId);

  const result: PriceResult = {
    price: parseFloat(price),
    price_raw: price,
    timestamp: new Date().toISOString(),
    threshold_triggered: false,
    trigger_direction: null,
  };

  if (params.price_threshold) {
    if (params.price_threshold.above && result.price > parseFloat(params.price_threshold.above)) {
      result.threshold_triggered = true;
      result.trigger_direction = "above";
    }
    if (params.price_threshold.below && result.price < parseFloat(params.price_threshold.below)) {
      result.threshold_triggered = true;
      result.trigger_direction = "below";
    }
  }

  return result;
}

