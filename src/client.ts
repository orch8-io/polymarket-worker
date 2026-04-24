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
  POLYMARKET_V2_CONFIG,
  EIP712_DOMAIN,
  EIP712_ORDER_DOMAIN,
  ORDER_TYPES,
  AUTH_TYPES,
  PolymarketError,
} from "./types.js";

function classifyError(status: number, body: string): PolymarketError {
  const lower = body.toLowerCase();

  // Non-retryable client errors
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

  // Retryable errors
  if (status === 429) {
    return new PolymarketError("Rate limited — backoff and retry", 429, true, "RATE_LIMITED");
  }

  if (status >= 500) {
    return new PolymarketError(`Server error: ${body}`, status, true, "SERVER_ERROR");
  }

  return new PolymarketError(`Polymarket API ${status}: ${body}`, status, false, "UNKNOWN");
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

    const res = await fetch(
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
      },
    );

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    return (await res.json()) as ApiCredentials;
  }

  async placeOrder(
    params: PlaceOrderParams,
    privateKey: string,
    creds: ApiCredentials,
  ): Promise<OrderResult> {
    const wallet = new ethers.Wallet(privateKey);

    const priceNum = parseFloat(params.price);
    const sizeNum = parseFloat(params.size);

    const makerAmount =
      params.side === "BUY"
        ? ethers.parseUnits((sizeNum * priceNum).toFixed(6), 6)
        : ethers.parseUnits(sizeNum.toFixed(6), 6);

    const takerAmount =
      params.side === "BUY"
        ? ethers.parseUnits(sizeNum.toFixed(6), 6)
        : ethers.parseUnits((sizeNum * priceNum).toFixed(6), 6);

    const salt = BigInt(
      ethers.hexlify(ethers.randomBytes(32)),
    );

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
      signatureType: 0n, // EOA
    };

    const domain = {
      ...EIP712_ORDER_DOMAIN,
      verifyingContract: this.config.exchangeAddress,
    };

    const signature = await wallet.signTypedData(
      domain,
      ORDER_TYPES,
      orderData,
    );

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

    const res = await fetch(`${this.config.clobBaseUrl}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

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

    const res = await fetch(`${this.config.clobBaseUrl}${path}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    return { cancelled: true, order_id: orderId };
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const res = await fetch(
      `${this.config.clobBaseUrl}/order/${orderId}`,
    );

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    return (await res.json()) as OrderDetail;
  }

  async getOrderbook(tokenId: string): Promise<OrderbookResult> {
    const res = await fetch(
      `${this.config.clobBaseUrl}/book?token_id=${tokenId}`,
    );

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    const data = (await res.json()) as {
      bids: Array<{ price: string; size: string }>;
      asks: Array<{ price: string; size: string }>;
    };

    const bestBid = data.bids[0]?.price ?? "0";
    const bestAsk = data.asks[0]?.price ?? "1";
    const bidNum = parseFloat(bestBid);
    const askNum = parseFloat(bestAsk);

    return {
      ...data,
      spread: (askNum - bidNum).toFixed(4),
      mid_price: ((askNum + bidNum) / 2).toFixed(4),
      timestamp: new Date().toISOString(),
    };
  }

  async getPositions(accountAddress: string): Promise<PositionsResult> {
    const res = await fetch(
      `${this.config.clobBaseUrl}/positions?address=${accountAddress}`,
    );

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    const positions = (await res.json()) as PositionsResult;
    return positions;
  }

  async getMarket(marketId: string): Promise<MarketResult> {
    const res = await fetch(
      `${this.config.clobBaseUrl}/markets/${marketId}`,
    );

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    return (await res.json()) as MarketResult;
  }

  async getPrice(tokenId: string): Promise<string> {
    const res = await fetch(
      `${this.config.clobBaseUrl}/price?token_id=${tokenId}`,
    );

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    const data = (await res.json()) as { price: string };
    return data.price;
  }

  async getTrades(
    tokenId: string,
    creds: ApiCredentials,
    options?: { limit?: number; before?: string; after?: string },
  ): Promise<Array<{ price: string; size: string; side: string; timestamp: string; transaction_hash: string }>> {
    const qs = new URLSearchParams({ token_id: tokenId });
    if (options?.limit) qs.set("limit", String(options.limit));
    if (options?.before) qs.set("before", options.before);
    if (options?.after) qs.set("after", options.after);

    const path = `/trades?${qs.toString()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = hmacHeaders(creds, "GET", path, "", timestamp);

    const res = await fetch(`${this.config.clobBaseUrl}${path}`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw classifyError(res.status, await res.text());
    }

    return (await res.json()) as Array<{ price: string; size: string; side: string; timestamp: string; transaction_hash: string }>;
  }
}
