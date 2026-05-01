import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, GetSpreadParamsSchema, sanitizeTokenId } from "../validation.js";

export async function polyGetSpread(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetSpreadParamsSchema, task.params);
  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }
  const tokenId = sanitizeTokenId(params.token_id);

  const client = new PolymarketClient();
  return client.getSpread(tokenId);
}
