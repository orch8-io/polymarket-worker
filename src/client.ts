import { ethers } from "ethers";
import {
  type PolymarketConfig,
  type ApiCredentials,
  type PlaceOrderParams,
  type OrderResult,
  type OrderDetail,
  type OrderbookResult,
  type PositionsResult,
  type MarketResult,
  type OpenOrder,
  type CancelAllResult,
  type BalanceAllowanceResult,
  type MidpointResult,
  type SpreadResult,
  type TickSizeResult,
  type NegRiskResult,
  POLYMARKET_V2_CONFIG,
  EIP712_DOMAIN,
  EIP712_ORDER_DOMAIN,
  ORDER_TYPES,
  AUTH_TYPES,
  PolymarketError,
} from "./types.js";

// ── Timeouts ───────────────────────────────────────────────────────────────
const READ_TIMEOUT_MS = 10_000;
const WRITE_TIMEOUT_MS = 30_000;

// ── Retry config ───────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

function classifyError(status: number, body: string): PolymarketError {
  const lower = body.toLowerCase();

  if (status === 400) {
    if (lower.includes("insufficient balance")) {
      return new PolymarketError("Insufficient balance", 400, false, "INSUFFICIENT_BALANCE");
    }
    if (lower.includes("too small") || lower.includes("minimum")) {
      return new PolymarketError("Order size too small", 400, false, "ORDER_TOO_SMALL");
    }
    if (lower.includes("invalid signature") || lower.includes("signature")) {
      return new PolymarketError("Invalid signature", 400, false, "INVALID_SIGNATURE");
    }
    if (lower.includes("expired")) {
      return new PolymarketError("Order expired", 400, false, "ORDER_EXPIRED");
    }
    return new PolymarketError(`Bad request: ${body}`, 400, false, "BAD_REQUEST");
  }

  if (status === 401) {
    return new PolymarketError("Unauthorized — check API credentials", 401, false, "UNAUTHORIZED");
  }

  if (status === 403) {
    return new PolymarketError("Forbidden — API key may be revoked", 403, false, "FORBIDDEN");
  }

  if (status === 404) {
    return new PolymarketError("Not found", 404, false, "NOT_FOUND");
  }

  if (status === 409) {
    return new PolymarketError("Conflict — order may already exist", 409, false, "CONFLICT");
  }

  if (status === 429) {
    return new PolymarketError("Rate limited — backoff and retry", 429, true, "RATE_LIMITED");
  }

  if (status >= 500) {
    return new PolymarketError(`Server error: ${body}`, status, true, "SERVER_ERROR");
  }

  return new PolymarketError(`Polymarket API ${status}: ${body}`, status, false, "UNKNOWN");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = READ_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new PolymarketError(`Request timeout after ${timeoutMs}ms`, 504, true, "TIMEOUT");
    }
    throw new PolymarketError(
      err instanceof Error ? err.message : "Network error",
      0,
      true,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (res.ok) return res;

      const body = await res.text();
      const err = classifyError(res.status, body);
      if (!err.retryable || attempt === MAX_RETRIES) throw err;

      lastErr = err;
    } catch (err) {
      if (err instanceof PolymarketError && !err.retryable) throw err;
      if (attempt === MAX_RETRIES) throw err;
      lastErr = err instanceof Error ? err : new Error(String(err));
    }

    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    const jitter = Math.random() * 100;
    await new Promise((r) => setTimeout(r, backoff + jitter));
  }

  throw lastErr ?? new PolymarketError("Max retries exceeded", 0, true, "MAX_RETRIES");
}

function hmacHeaders(
  creds: ApiCredentials,
  method: string,
  path: string,
  body: string,
  timestamp: string,
  address?: string,
): Record<string, string> {
  const message = timestamp + method.toUpperCase() + path + body;
  const key = Buffer.from(creds.api_secret, "base64");
  const hmac = ethers.computeHmac("sha256", key, Buffer.from(message));

  return {
    POLY_ADDRESS: address || "",
    POLY_SIGNATURE: hmac,
    POLY_TIMESTAMP: timestamp,
    POLY_API_KEY: creds.api_key,
    POLY_PASSPHRASE: creds.api_passphrase,
  };
}

/** Parse a decimal string into a BigInt with the given number of decimals. */
function parseDecimal(value: string, decimals: number): bigint {
  const [intPart = "0", fracPart = ""] = value.split(".");
  const padded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(intPart + padded);
}

export class PolymarketClient {
  private readonly config: PolymarketConfig;

  constructor(config: Partial<PolymarketConfig> = {}) {
    this.config = {
      ...POLYMARKET_V2_CONFIG,
      ...(process.env.POLYMARKET_CLOB_URL && { clobBaseUrl: process.env.POLYMARKET_CLOB_URL }),
      ...config,
    };
  }

  async deriveApiKey(privateKey: string): Promise<ApiCredentials> {
    const wallet = new ethers.Wallet(privateKey);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 0;

    const domain = {
      ...EIP712_DOMAIN,
      verifyingContract: this.config.exchangeAddress,
    };

    const signature = await wallet.signTypedData(domain, AUTH_TYPES, {
      address: wallet.address,
      timestamp,
      nonce,
      message: "This message attests that I control the given wallet",
    });

    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/auth/derive-api-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: wallet.address,
          signature,
          timestamp,
          nonce,
        }),
        timeoutMs: WRITE_TIMEOUT_MS,
      },
    );

    return (await res.json()) as ApiCredentials;
  }

  async placeOrder(
    params: PlaceOrderParams,
    privateKey: string,
    creds: ApiCredentials,
  ): Promise<OrderResult> {
    const wallet = new ethers.Wallet(privateKey);

    // Use string-based decimal math to avoid floating-point rounding errors.
    const sizeBn = parseDecimal(params.size, 6);
    const priceBn = parseDecimal(params.price, 6);
    const notionalBn = (sizeBn * priceBn) / 1_000_000n;

    const makerAmount = params.side === "BUY" ? notionalBn : sizeBn;
    const takerAmount = params.side === "BUY" ? sizeBn : notionalBn;

    const salt = BigInt(ethers.hexlify(ethers.randomBytes(32)));

    const expiration =
      params.order_type === "GTD" && params.expiration
        ? BigInt(params.expiration)
        : 0n;

    const orderData = {
      salt,
      maker: wallet.address,
      signer: wallet.address,
      taker: ethers.ZeroAddress,
      tokenId: BigInt(params.token_id),
      makerAmount,
      takerAmount,
      expiration,
      signatureType: 0n,
    };

    const domain = {
      ...EIP712_ORDER_DOMAIN,
      verifyingContract: this.config.exchangeAddress,
    };

    const signature = await wallet.signTypedData(domain, ORDER_TYPES, orderData);

    const body = JSON.stringify({
      order: {
        salt: orderData.salt.toString(),
        maker: orderData.maker,
        signer: orderData.signer,
        taker: orderData.taker,
        tokenId: orderData.tokenId.toString(),
        makerAmount: orderData.makerAmount.toString(),
        takerAmount: orderData.takerAmount.toString(),
        expiration: orderData.expiration.toString(),
        signatureType: Number(orderData.signatureType),
        signature,
      },
      orderType: params.order_type,
      side: params.side,
      ...(params.builder_code && { builderCode: params.builder_code }),
    });

    const path = "/order";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "POST", path, body, timestamp, wallet.address);

    const res = await fetchWithRetry(`${this.config.clobBaseUrl}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
      timeoutMs: WRITE_TIMEOUT_MS,
    });

    return (await res.json()) as OrderResult;
  }

  async cancelOrder(
    orderId: string,
    creds: ApiCredentials,
  ): Promise<{ cancelled: boolean; order_id: string }> {
    const body = JSON.stringify({ orderID: orderId });
    const path = "/order";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "DELETE", path, body, timestamp);

    const res = await fetchWithRetry(`${this.config.clobBaseUrl}${path}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
      timeoutMs: WRITE_TIMEOUT_MS,
    });

    if (!res.ok) {
      const text = await res.text();
      throw classifyError(res.status, text);
    }

    return { cancelled: true, order_id: orderId };
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/order/${encodeURIComponent(orderId)}`,
    );

    return (await res.json()) as OrderDetail;
  }

  async getOrderbook(tokenId: string): Promise<OrderbookResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/book?token_id=${encodeURIComponent(tokenId)}`,
    );

    const data = (await res.json()) as {
      bids: Array<{ price: string; size: string }>;
      asks: Array<{ price: string; size: string }>;
    };

    const bestBid = data.bids[0]?.price ?? "0";
    const bestAsk = data.asks[0]?.price ?? "0";
    const bidNum = parseFloat(bestBid);
    const askNum = parseFloat(bestAsk);

    // Guard against zero/invalid ask prices.
    const spread = askNum > 0 && bidNum >= 0 ? (askNum - bidNum).toFixed(4) : "0";
    const midPrice = askNum > 0 && bidNum >= 0 ? ((askNum + bidNum) / 2).toFixed(4) : "0";

    return {
      ...data,
      spread,
      mid_price: midPrice,
      timestamp: new Date().toISOString(),
    };
  }

  async getPositions(accountAddress: string): Promise<PositionsResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/positions?address=${encodeURIComponent(accountAddress)}`,
    );

    return (await res.json()) as PositionsResult;
  }

  async getMarket(marketId: string): Promise<MarketResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/markets/${encodeURIComponent(marketId)}`,
    );

    return (await res.json()) as MarketResult;
  }

  async getPrice(tokenId: string): Promise<string> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/price?token_id=${encodeURIComponent(tokenId)}`,
    );

    const data = (await res.json()) as { price: string };
    return data.price;
  }

  async getTrades(
    tokenId: string,
    creds: ApiCredentials,
    options?: { limit?: number; before?: string; after?: string },
  ): Promise<Array<{ price: string; size: string; side: string; timestamp: string; transaction_hash: string }>> {
    const qs = new URLSearchParams({ token_id: tokenId });
    if (options?.limit) {
      const limit = Math.max(1, Math.min(options.limit, 1000));
      qs.set("limit", String(limit));
    }
    if (options?.before) qs.set("before", options.before);
    if (options?.after) qs.set("after", options.after);

    const path = `/trades?${qs.toString()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "GET", path, "", timestamp);

    const res = await fetchWithRetry(`${this.config.clobBaseUrl}${path}`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });

    return (await res.json()) as Array<{
      price: string;
      size: string;
      side: string;
      timestamp: string;
      transaction_hash: string;
    }>;
  }

  async getOrders(
    creds: ApiCredentials,
    options?: { market?: string; asset_id?: string },
  ): Promise<OpenOrder[]> {
    const qs = new URLSearchParams();
    if (options?.market) qs.set("market", options.market);
    if (options?.asset_id) qs.set("asset_id", options.asset_id);

    const path = `/orders?${qs.toString()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "GET", path, "", timestamp);

    const res = await fetchWithRetry(`${this.config.clobBaseUrl}${path}`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });

    return (await res.json()) as OpenOrder[];
  }

  async cancelAllOrders(
    creds: ApiCredentials,
    options?: { market?: string; asset_id?: string },
  ): Promise<CancelAllResult> {
    const qs = new URLSearchParams();
    if (options?.market) qs.set("market", options.market);
    if (options?.asset_id) qs.set("asset_id", options.asset_id);

    const path = `/orders?${qs.toString()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "DELETE", path, "", timestamp);

    const res = await fetchWithRetry(`${this.config.clobBaseUrl}${path}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      timeoutMs: WRITE_TIMEOUT_MS,
    });

    if (!res.ok) {
      const text = await res.text();
      throw classifyError(res.status, text);
    }

    const data = (await res.json()) as { cancelled?: number[] };
    const count = data.cancelled?.length ?? 0;
    return { cancelled: true, count };
  }

  async getBalanceAllowance(
    creds: ApiCredentials,
    address?: string,
  ): Promise<BalanceAllowanceResult> {
    const path = address ? `/balance/${encodeURIComponent(address)}` : "/balance";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "GET", path, "", timestamp);

    const res = await fetchWithRetry(`${this.config.clobBaseUrl}${path}`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });

    return (await res.json()) as BalanceAllowanceResult;
  }

  async getMidpoint(tokenId: string): Promise<MidpointResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/midpoint?token_id=${encodeURIComponent(tokenId)}`,
    );

    const data = (await res.json()) as { midpoint: string };
    return {
      token_id: tokenId,
      midpoint: data.midpoint,
      timestamp: new Date().toISOString(),
    };
  }

  async getSpread(tokenId: string): Promise<SpreadResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/spread?token_id=${encodeURIComponent(tokenId)}`,
    );

    const data = (await res.json()) as { spread: string };
    return {
      token_id: tokenId,
      spread: data.spread,
      timestamp: new Date().toISOString(),
    };
  }

  async getTickSize(tokenId: string): Promise<TickSizeResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/tick-size/${encodeURIComponent(tokenId)}`,
    );

    const data = (await res.json()) as { tick_size: string };
    return {
      token_id: tokenId,
      tick_size: data.tick_size,
    };
  }

  async getNegRisk(tokenId: string): Promise<NegRiskResult> {
    const res = await fetchWithRetry(
      `${this.config.clobBaseUrl}/neg-risk/${encodeURIComponent(tokenId)}`,
    );

    const data = (await res.json()) as { neg_risk: boolean };
    return {
      token_id: tokenId,
      neg_risk: data.neg_risk,
    };
  }
}
