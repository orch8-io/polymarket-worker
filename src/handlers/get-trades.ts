import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, parseContext, GetTradesParamsSchema, isValidCreds, sanitizeTokenId } from "../validation.js";

export async function polyGetTrades(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetTradesParamsSchema, task.params);
  const context = parseContext(task.context);

  if (!params.token_id) {
    throw new PolymarketError("token_id is required", 400, false);
  }
  const tokenId = sanitizeTokenId(params.token_id);

  const creds = context.api_credentials;
  if (!isValidCreds(creds)) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const client = new PolymarketClient();
  return client.getTrades(
    tokenId,
    creds,
    {
      limit: params.limit,
      before: params.before,
      after: params.after,
    },
  );
}
