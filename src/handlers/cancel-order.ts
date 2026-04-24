import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { CancelOrderParams, ApiCredentials } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyCancelOrder(task: WorkerTask): Promise<unknown> {
  const params = task.params as CancelOrderParams;
  const context = task.context as Record<string, unknown>;

  if (!params.order_id) {
    throw new PolymarketError("order_id is required", 400, false);
  }

  const creds = context.api_credentials as ApiCredentials | undefined;
  if (!creds?.api_key || !creds?.api_secret || !creds?.api_passphrase) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.cancelOrder(params.order_id, creds);
}
