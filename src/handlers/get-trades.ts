import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { ApiCredentials } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyGetTrades(task: WorkerTask): Promise<unknown> {
  const params = task.params as Record<string, unknown>;
  const context = task.context as Record<string, unknown>;

  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }

  const creds = context.api_credentials as ApiCredentials | undefined;
  if (!creds?.api_key || !creds?.api_secret || !creds?.api_passphrase) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.getTrades(
    String(params.token_id),
    creds,
    {
      limit: params.limit ? Number(params.limit) : undefined,
      before: params.before ? String(params.before) : undefined,
      after: params.after ? String(params.after) : undefined,
    },
  );
}
