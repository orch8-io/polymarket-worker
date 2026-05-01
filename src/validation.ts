import { z } from "zod";
import { PolymarketError } from "./types.js";

export const ApiCredentialsSchema = z.object({
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  api_passphrase: z.string().optional(),
});

export const ContextSchema = z.object({
  private_key: z.string().optional(),
  api_credentials: ApiCredentialsSchema.optional(),
});

export const CreateApiKeyParamsSchema = z.object({
  private_key: z.string().optional(),
});

export const PlaceOrderParamsSchema = z.object({
  market_id: z.string().optional(),
  token_id: z.string().optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  size: z.string().optional(),
  price: z.string().optional(),
  order_type: z.enum(["GTC", "GTD", "FOK"]).optional(),
  expiration: z.number().optional(),
  builder_code: z.string().optional(),
});

export const CancelOrderParamsSchema = z.object({
  order_id: z.string().optional(),
});

export const GetOrderParamsSchema = z.object({
  order_id: z.string().optional(),
});

export const GetOrderbookParamsSchema = z.object({
  token_id: z.string().optional(),
});

export const GetPositionsParamsSchema = z.object({
  account_address: z.string().optional(),
});

export const GetMarketParamsSchema = z.object({
  market_id: z.string().optional(),
});

export const StreamPricesParamsSchema = z.object({
  token_id: z.string().optional(),
  check_interval_ms: z.number().optional(),
  price_threshold: z
    .object({
      above: z.string().optional(),
      below: z.string().optional(),
    })
    .optional(),
});

export const GetTradesParamsSchema = z.object({
  token_id: z.string().optional(),
  limit: z.number().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const GetBalanceParamsSchema = z.object({
  address: z.string().optional(),
});

export const GetMidpointParamsSchema = z.object({
  token_id: z.string().optional(),
});

export const GetSpreadParamsSchema = z.object({
  token_id: z.string().optional(),
});

export const GetTickSizeParamsSchema = z.object({
  token_id: z.string().optional(),
});

export const GetNegRiskParamsSchema = z.object({
  token_id: z.string().optional(),
});

export const DiscoverMarketsParamsSchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  order: z.string().optional(),
  ascending: z.boolean().optional(),
  closed: z.boolean().optional(),
  active: z.boolean().optional(),
  tag: z.string().optional(),
  end_date_min: z.string().optional(),
  end_date_max: z.string().optional(),
});

export const CheckResolutionParamsSchema = z.object({
  condition_id: z.string().optional(),
});

export const CancelAllOrdersParamsSchema = z.object({
  market: z.string().optional(),
  asset_id: z.string().optional(),
});

export const GetOrdersParamsSchema = z.object({
  market: z.string().optional(),
  asset_id: z.string().optional(),
});

// ── Response schemas ────────────────────────────────────────────────────────

export const ApiCredentialsResponseSchema = z.object({
  api_key: z.string(),
  api_secret: z.string(),
  api_passphrase: z.string(),
});

export const OrderResultResponseSchema = z.object({
  order_id: z.string(),
  status: z.enum(["LIVE", "MATCHED", "CANCELLED", "EXPIRED"]),
  size_matched: z.string(),
  price: z.string(),
  timestamp: z.string(),
  transaction_hash: z.string().optional(),
});

export const OrderDetailResponseSchema = z.object({
  order_id: z.string(),
  status: z.enum(["LIVE", "MATCHED", "CANCELLED", "EXPIRED"]),
  size_matched: z.string(),
  size_remaining: z.string(),
  average_price: z.string(),
  fills: z.array(
    z.object({
      price: z.string(),
      size: z.string(),
      timestamp: z.string(),
    }),
  ),
});

export const OrderbookResponseSchema = z.object({
  bids: z.array(
    z.object({
      price: z.string(),
      size: z.string(),
    }),
  ),
  asks: z.array(
    z.object({
      price: z.string(),
      size: z.string(),
    }),
  ),
});

export const PositionSchema = z.object({
  market_id: z.string(),
  token_id: z.string(),
  size: z.string(),
  average_entry: z.string(),
  current_price: z.string(),
  pnl: z.string(),
  pnl_percent: z.string(),
});

export const PositionsResultResponseSchema = z.object({
  positions: z.array(PositionSchema),
  total_value: z.string(),
  unrealized_pnl: z.string(),
});

export const MarketResultResponseSchema = z.object({
  condition_id: z.string(),
  question: z.string(),
  tokens: z.array(
    z.object({
      token_id: z.string(),
      outcome: z.string(),
      price: z.string(),
    }),
  ),
  volume: z.string(),
  liquidity: z.string(),
  end_date: z.string(),
  active: z.boolean(),
});

export const PriceResponseSchema = z.object({
  price: z.string(),
});

export const TradeSchema = z.object({
  price: z.string(),
  size: z.string(),
  side: z.string(),
  timestamp: z.string(),
  transaction_hash: z.string(),
});

export const TradesResponseSchema = z.array(TradeSchema);

export const OpenOrderSchema = z.object({
  order_id: z.string(),
  status: z.enum(["LIVE", "MATCHED", "CANCELLED", "EXPIRED"]),
  market_id: z.string(),
  token_id: z.string(),
  side: z.enum(["BUY", "SELL"]),
  size: z.string(),
  price: z.string(),
  order_type: z.enum(["GTC", "GTD", "FOK"]),
  expiration: z.string().optional(),
  created_at: z.string(),
});

export const OpenOrdersResponseSchema = z.array(OpenOrderSchema);

export const CancelAllResponseSchema = z.object({
  cancelled: z.array(z.number()),
});

export const BalanceResponseSchema = z.object({
  balance: z.string(),
  allowance: z.string(),
  address: z.string(),
});

export const MidpointResponseSchema = z.object({
  midpoint: z.string(),
});

export const SpreadResponseSchema = z.object({
  spread: z.string(),
});

export const TickSizeResponseSchema = z.object({
  tick_size: z.string(),
});

export const NegRiskResponseSchema = z.object({
  neg_risk: z.boolean(),
});

export const GammaMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  condition_id: z.string(),
  slug: z.string(),
  end_date_iso: z.string(),
  description: z.string(),
  active: z.boolean(),
  closed: z.boolean(),
  volume: z.string(),
  liquidity: z.string(),
  outcomes: z.array(z.string()),
  outcome_prices: z.array(z.string()),
  tokens: z.array(
    z.object({
      token_id: z.string(),
      outcome: z.string(),
      price: z.number(),
    }),
  ),
  tags: z.array(z.string()),
  category: z.string(),
});

export const DiscoverMarketsResponseSchema = z.array(GammaMarketSchema);

export const CheckResolutionResponseSchema = z.object({
  payoutNumerators: z.array(z.number()).optional(),
  resolutionSource: z.string().optional(),
});

// ── Param parsing helpers ───────────────────────────────────────────────────

export function parseParams<T extends z.ZodTypeAny>(
  schema: T,
  params: unknown,
): z.infer<T> {
  try {
    return schema.parse(params);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new PolymarketError("Invalid params: " + err.message, 400, false);
    }
    throw err;
  }
}

export function isValidCreds(
  creds: z.infer<typeof ApiCredentialsSchema> | undefined,
): creds is { api_key: string; api_secret: string; api_passphrase: string } {
  return !!creds && !!creds.api_key && !!creds.api_secret && !!creds.api_passphrase;
}

export function parseContext(context: unknown): z.infer<typeof ContextSchema> {
  try {
    return ContextSchema.parse(context);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new PolymarketError("Invalid params: " + err.message, 400, false);
    }
    throw err;
  }
}

// ── Input sanitization ──────────────────────────────────────────────────────

export function sanitizeTokenId(id: string): string {
  if (!id || typeof id !== "string") throw new PolymarketError("token_id is required", 400, false);
  if (id.length > 128) throw new PolymarketError("token_id too long", 400, false);
  if (!/^\d+$/.test(id)) {
    throw new PolymarketError("Invalid token_id format (must be numeric)", 400, false);
  }
  return id;
}

export function sanitizeMarketId(id: string): string {
  if (!id || typeof id !== "string") throw new PolymarketError("market_id is required", 400, false);
  if (id.length > 128) throw new PolymarketError("market_id too long", 400, false);
  return id;
}

export function sanitizeConditionId(id: string): string {
  if (!id || typeof id !== "string") throw new PolymarketError("condition_id is required", 400, false);
  if (id.length > 128) throw new PolymarketError("condition_id too long", 400, false);
  return id;
}

export function sanitizeAddress(address: string): string {
  if (!address || typeof address !== "string") throw new PolymarketError("address is required", 400, false);
  if (address.length > 128) throw new PolymarketError("address too long", 400, false);
  return address;
}

export function sanitizeBuilderCode(code: string | undefined): string | undefined {
  if (code === undefined) return undefined;
  if (typeof code !== "string" || code.length > 64) {
    throw new PolymarketError("Invalid builder_code", 400, false);
  }
  return code;
}

export function sanitizeOrderId(id: string): string {
  if (!id || typeof id !== "string") throw new PolymarketError("order_id is required", 400, false);
  if (id.length > 128) throw new PolymarketError("order_id too long", 400, false);
  return id;
}
