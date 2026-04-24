import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { CreateApiKeyParams } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyCreateApiKey(task: WorkerTask): Promise<unknown> {
  const params = task.params as CreateApiKeyParams;
  if (!params.private_key) {
    throw new PolymarketError("private_key is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.deriveApiKey(params.private_key);
}
