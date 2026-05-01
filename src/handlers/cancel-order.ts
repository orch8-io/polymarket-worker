import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, parseContext, CancelOrderParamsSchema, isValidCreds, sanitizeOrderId } from "../validation.js";

export async function polyCancelOrder(task: WorkerTask): Promise<unknown> {
  const params = parseParams(CancelOrderParamsSchema, task.params);
  const context = parseContext(task.context);

  if (!params.order_id) {
    throw new PolymarketError("order_id is required", 400, false);
  }
  const orderId = sanitizeOrderId(params.order_id);

  const creds = context.api_credentials;
  if (!isValidCreds(creds)) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.cancelOrder(orderId, creds);
}
