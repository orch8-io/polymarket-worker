import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { GetMarketParams } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyGetMarket(task: WorkerTask): Promise<unknown> {
  const params = task.params as GetMarketParams;
  if (!params.market_id) {
    throw new PolymarketError("market_id is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.getMarket(params.market_id);
}
