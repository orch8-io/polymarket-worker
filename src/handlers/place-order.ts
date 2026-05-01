import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketClient } from "../client.js";
import { PolymarketError } from "../types.js";
import { parseParams, parseContext, PlaceOrderParamsSchema, isValidCreds, sanitizeTokenId, sanitizeBuilderCode } from "../validation.js";

export async function polyPlaceOrder(task: WorkerTask): Promise<unknown> {
  const params = parseParams(PlaceOrderParamsSchema, task.params);
  const context = parseContext(task.context);

  const privateKey = context.private_key;
  if (!privateKey) {
    throw new PolymarketError("private_key missing from context", 400, false);
  }

  const creds = context.api_credentials;
  if (!isValidCreds(creds)) {
    throw new PolymarketError("api_credentials missing from context", 400, false);
  }

  if (!params.token_id || !params.side || !params.size || !params.price) {
    throw new PolymarketError(
      "token_id, side, size, and price are required",
      400,
      false,
    );
  }

  if (!params.order_type) {
    throw new PolymarketError("order_type is required", 400, false);
  }

  const tokenId = sanitizeTokenId(params.token_id);

  const client = new PolymarketClient();
  return client.placeOrder(
    {
      market_id: params.market_id ?? "",
      token_id: tokenId,
      side: params.side,
      size: params.size,
      price: params.price,
      order_type: params.order_type,
      expiration: params.expiration,
      builder_code: sanitizeBuilderCode(params.builder_code),
    },
    privateKey,
    creds,
  );
}
