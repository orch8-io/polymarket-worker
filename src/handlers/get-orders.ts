import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, parseContext, GetOrdersParamsSchema, isValidCreds } from "../validation.js";

export async function polyGetOrders(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetOrdersParamsSchema, task.params);
  const context = parseContext(task.context);

  const creds = context.api_credentials;
  if (!isValidCreds(creds)) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.getOrders(creds, {
    market: params.market,
    asset_id: params.asset_id,
  });
}
