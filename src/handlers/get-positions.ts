import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, GetPositionsParamsSchema, sanitizeAddress } from "../validation.js";

export async function polyGetPositions(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetPositionsParamsSchema, task.params);
  if (!params.account_address) {
    throw new PolymarketError("account_address is required", 400, false);
  }

  const address = sanitizeAddress(params.account_address);
  const client = new PolymarketClient();
  return client.getPositions(address);
}
