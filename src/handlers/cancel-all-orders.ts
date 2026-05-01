import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, parseContext, CancelAllOrdersParamsSchema, isValidCreds } from "../validation.js";

export async function polyCancelAllOrders(task: WorkerTask): Promise<unknown> {
  const params = parseParams(CancelAllOrdersParamsSchema, task.params);
  const context = parseContext(task.context);

  const creds = context.api_credentials;
  if (!isValidCreds(creds)) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.cancelAllOrders(creds, {
    market: params.market,
    asset_id: params.asset_id,
  });
}
