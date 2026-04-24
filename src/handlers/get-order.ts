import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { GetOrderParams } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyGetOrder(task: WorkerTask): Promise<unknown> {
  const params = task.params as GetOrderParams;
  if (!params.order_id) {
    throw new PolymarketError("order_id is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.getOrder(params.order_id);
}
