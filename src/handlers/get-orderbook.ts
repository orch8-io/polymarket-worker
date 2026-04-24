import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { GetOrderbookParams } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyGetOrderbook(task: WorkerTask): Promise<unknown> {
  const params = task.params as GetOrderbookParams;
  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.getOrderbook(params.token_id);
}
