import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, GetMarketParamsSchema, sanitizeMarketId } from "../validation.js";

export async function polyGetMarket(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetMarketParamsSchema, task.params);
  if (!params.market_id) {
    throw new PolymarketError("market_id is required", 400, false);
  }

  const marketId = sanitizeMarketId(params.market_id);
  const client = new PolymarketClient();
  return client.getMarket(marketId);
}
