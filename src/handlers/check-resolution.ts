import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, CheckResolutionParamsSchema, sanitizeConditionId } from "../validation.js";

export async function polyCheckResolution(task: WorkerTask): Promise<unknown> {
  const params = parseParams(CheckResolutionParamsSchema, task.params);
  if (!params.condition_id) {
    throw new PolymarketError("condition_id is required", 400, false);
  }
  const conditionId = sanitizeConditionId(params.condition_id);
  const client = new PolymarketClient();
  return client.checkResolution(conditionId);
}
