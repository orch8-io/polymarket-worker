import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, GetOrderParamsSchema, sanitizeOrderId } from "../validation.js";

export async function polyGetOrder(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetOrderParamsSchema, task.params);
  if (!params.order_id) {
    throw new PolymarketError("order_id is required", 400, false);
  }
  const orderId = sanitizeOrderId(params.order_id);

  const client = new PolymarketClient();
  return client.getOrder(orderId);
}
