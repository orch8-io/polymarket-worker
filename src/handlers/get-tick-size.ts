import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";

export async function polyGetTickSize(task: WorkerTask): Promise<unknown> {
  const params = task.params as Record<string, unknown>;
  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.getTickSize(String(params.token_id));
}
