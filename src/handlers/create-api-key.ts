import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, CreateApiKeyParamsSchema } from "../validation.js";

export async function polyCreateApiKey(task: WorkerTask): Promise<unknown> {
  const params = parseParams(CreateApiKeyParamsSchema, task.params);
  if (!params.private_key) {
    throw new PolymarketError("private_key is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.deriveApiKey(params.private_key);
}
