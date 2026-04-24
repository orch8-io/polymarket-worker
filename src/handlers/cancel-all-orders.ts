import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { ApiCredentials } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyCancelAllOrders(task: WorkerTask): Promise<unknown> {
  const params = task.params as Record<string, unknown>;
  const context = task.context as Record<string, unknown>;

  const creds = context.api_credentials as ApiCredentials | undefined;
  if (!creds?.api_key || !creds?.api_secret || !creds?.api_passphrase) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.cancelAllOrders(creds, {
    market: params.market ? String(params.market) : undefined,
    asset_id: params.asset_id ? String(params.asset_id) : undefined,
  });
}
