import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { StreamPricesParams, PriceResult } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyGetPrice(task: WorkerTask): Promise<unknown> {
  const params = task.params as StreamPricesParams;
  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }

  const client = new PolymarketClient();
  const price = await client.getPrice(params.token_id);
  const priceNum = parseFloat(price);

  const result: PriceResult = {
    price,
    timestamp: new Date().toISOString(),
    threshold_triggered: false,
    trigger_direction: null,
  };

  if (params.price_threshold) {
    if (params.price_threshold.above && priceNum > parseFloat(params.price_threshold.above)) {
      result.threshold_triggered = true;
      result.trigger_direction = "above";
    }
    if (params.price_threshold.below && priceNum < parseFloat(params.price_threshold.below)) {
      result.threshold_triggered = true;
      result.trigger_direction = "below";
    }
  }

  return result;
}

/** @deprecated Use polyGetPrice instead. Kept for backward compatibility. */
export const polyStreamPrices = polyGetPrice;
