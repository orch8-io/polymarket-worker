import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { GetPositionsParams } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyGetPositions(task: WorkerTask): Promise<unknown> {
  const params = task.params as GetPositionsParams;
  if (!params.account_address) {
    throw new PolymarketError("account_address is required", 400, false);
  }

  const client = new PolymarketClient();
  return client.getPositions(params.account_address);
}
