import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, parseContext, GetBalanceParamsSchema, isValidCreds, sanitizeAddress } from "../validation.js";

export async function polyGetBalance(task: WorkerTask): Promise<unknown> {
  const params = parseParams(GetBalanceParamsSchema, task.params);
  const context = parseContext(task.context);

  const creds = context.api_credentials;
  if (!isValidCreds(creds)) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  const address = params.address ? sanitizeAddress(params.address) : undefined;
  const client = new PolymarketClient();
  return client.getBalanceAllowance(
    creds,
    address,
  );
}
