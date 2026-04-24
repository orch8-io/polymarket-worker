export interface PolymarketConfig {
  clobBaseUrl: string;
  chainId: number;
  exchangeAddress: string;
}

export const POLYMARKET_V2_CONFIG: PolymarketConfig = {
  clobBaseUrl: "https://clob.polymarket.com",
  chainId: 137,
  exchangeAddress: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // V2 CTF Exchange on Polygon
};

export const EIP712_DOMAIN = {
  name: "ClobAuthDomain",
  version: "2",
  chainId: 137,
} as const;

export const EIP712_ORDER_DOMAIN = {
  name: "CTFExchange",
  version: "2",
  chainId: 137,
} as const;

export const ORDER_TYPES = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "signatureType", type: "uint256" },
  ],
};

export const AUTH_TYPES = {
  ClobAuth: [
    { name: "address", type: "address" },
    { name: "timestamp", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "message", type: "string" },
  ],
};

export type OrderSide = "BUY" | "SELL";
export type OrderType = "GTC" | "GTD" | "FOK";
export type OrderStatus = "LIVE" | "MATCHED" | "CANCELLED" | "EXPIRED";

export interface PlaceOrderParams {
  market_id: string;
  token_id: string;
  side: OrderSide;
  size: string;
  price: string;
  order_type: OrderType;
  expiration?: number;
  builder_code?: string;
}

export interface OrderResult {
  order_id: string;
  status: OrderStatus;
  size_matched: string;
  price: string;
  timestamp: string;
  transaction_hash?: string;
}

export interface CancelOrderParams {
  order_id: string;
}

export interface CancelResult {
  cancelled: boolean;
  order_id: string;
}

export interface GetOrderParams {
  order_id: string;
}

export interface OrderDetail {
  order_id: string;
  status: OrderStatus;
  size_matched: string;
  size_remaining: string;
  average_price: string;
  fills: Array<{ price: string; size: string; timestamp: string }>;
}

export interface GetOrderbookParams {
  token_id: string;
}

export interface OrderbookResult {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  spread: string;
  mid_price: string;
  timestamp: string;
}

export interface GetPositionsParams {
  account_address: string;
}

export interface Position {
  market_id: string;
  token_id: string;
  size: string;
  average_entry: string;
  current_price: string;
  pnl: string;
  pnl_percent: string;
}

export interface PositionsResult {
  positions: Position[];
  total_value: string;
  unrealized_pnl: string;
}

export interface GetMarketParams {
  market_id: string;
}

export interface MarketResult {
  condition_id: string;
  question: string;
  tokens: Array<{ token_id: string; outcome: string; price: string }>;
  volume: string;
  liquidity: string;
  end_date: string;
  active: boolean;
}

export interface StreamPricesParams {
  token_id: string;
  check_interval_ms?: number;
  price_threshold?: {
    above?: string;
    below?: string;
  };
}

export interface PriceResult {
  price: string;
  timestamp: string;
  threshold_triggered: boolean;
  trigger_direction: "above" | "below" | null;
}

export interface ApiCredentials {
  api_key: string;
  api_secret: string;
  api_passphrase: string;
}

export interface CreateApiKeyParams {
  private_key: string;
}

export class PolymarketError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "PolymarketError";
  }
}
