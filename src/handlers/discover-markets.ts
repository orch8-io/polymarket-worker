import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { parseParams, DiscoverMarketsParamsSchema } from "../validation.js";

export async function polyDiscoverMarkets(task: WorkerTask): Promise<unknown> {
  const params = parseParams(DiscoverMarketsParamsSchema, task.params);
  const client = new PolymarketClient();
  return client.discoverMarkets(params);
}
