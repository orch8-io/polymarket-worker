import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import type { PlaceOrderParams, ApiCredentials } from "../types.js";
import { PolymarketError } from "../types.js";

export async function polyPlaceOrder(task: WorkerTask): Promise<unknown> {
  const params = task.params as PlaceOrderParams;
  const context = task.context as Record<string, unknown>;

  const privateKey = context.private_key as string | undefined;
  if (!privateKey) {
    throw new PolymarketError("private_key missing from context", 400, false);
  }

  const creds = context.api_credentials as ApiCredentials | undefined;
  if (!creds?.api_key || !creds?.api_secret || !creds?.api_passphrase) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  if (!params.token_id || !params.side || !params.size || !params.price) {
    throw new PolymarketError(
      "token_id, side, size, and price are required",
      400,
      false,
    );
  }

  const client = new PolymarketClient();
  return client.placeOrder(params, privateKey, creds);
}
