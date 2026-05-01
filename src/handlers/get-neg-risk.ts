import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, GetNegRiskParamsSchema, sanitizeTokenId } from "../validation.js";

export async function polyGetNegRisk(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetNegRiskParamsSchema, task.params);
  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }
  const tokenId = sanitizeTokenId(params.token_id);

  const client = new PolymarketClient();
  return client.getNegRisk(tokenId);
}
