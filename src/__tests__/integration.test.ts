import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorkerTask } from "@orch8.io/sdk";
import { PolymarketError } from "../types.js";
import {
  polyCreateApiKey,
  polyPlaceOrder,
  polyCancelOrder,
  polyCancelAllOrders,
  polyGetOrder,
  polyGetOrders,
  polyGetOrderbook,
  polyGetPositions,
  polyGetMarket,
  polyGetPrice,
  polyGetTrades,
  polyGetBalance,
  polyGetMidpoint,
  polyGetSpread,
  polyGetTickSize,
  polyGetNegRisk,
} from "../handlers/index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  } as Response;
}

function makeTask(params: Record<string, unknown>, context: Record<string, unknown> = {}): WorkerTask {
  return {
    id: "task-1",
    handler_name: "test",
    params,
    context,
  } as WorkerTask;
}

const validCreds = {
  api_key: "key",
  api_secret: Buffer.from("secret").toString("base64"),
  api_passphrase: "pass",
};

const privateKey = "0x" + "a".repeat(64);

describe("Integration: full trading workflow", () => {
  it("executes create key → get market → get orderbook → place order → get order → cancel order flow", async () => {
    // 1. Create API key
    mockFetch.mockResolvedValueOnce(jsonResponse({ api_key: "k1", api_secret: "s1", api_passphrase: "p1" }));
    const keyTask = makeTask({ private_key: privateKey });
    const creds = await polyCreateApiKey(keyTask);
    expect(creds).toEqual({ api_key: "k1", api_secret: "s1", api_passphrase: "p1" });

    // 2. Get market
    const market = {
      condition_id: "cid1",
      question: "Will it rain?",
      tokens: [{ token_id: "12345678901234567890", outcome: "Yes", price: "0.6" }],
      volume: "10000",
      liquidity: "1000",
      end_date: "2025-12-31",
      active: true,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(market));
    const marketResult = await polyGetMarket(makeTask({ market_id: "m1" }));
    expect(marketResult).toEqual(market);

    // 3. Get orderbook
    const book = {
      bids: [{ price: "0.58", size: "100" }],
      asks: [{ price: "0.62", size: "100" }],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(book));
    const bookResult = await polyGetOrderbook(makeTask({ token_id: "12345678901234567890" })) as Record<string, unknown>;
    expect(bookResult.spread).toBe("0.0400");
    expect(bookResult.mid_price).toBe("0.6000");

    // 4. Place order
    mockFetch.mockResolvedValueOnce(jsonResponse({ order_id: "oid1", status: "LIVE", size_matched: "0", price: "0.60", timestamp: "2025-01-01T00:00:00Z" }));
    const placeTask = makeTask(
      { market_id: "m1", token_id: "71321045679252212594626385532706912750332728571942532289631379312455583992563", side: "BUY", size: "10", price: "0.60", order_type: "GTC" },
      { private_key: privateKey, api_credentials: creds },
    );
    const orderResult = await polyPlaceOrder(placeTask);
    expect(orderResult).toHaveProperty("order_id", "oid1");

    // 5. Get order
    mockFetch.mockResolvedValueOnce(jsonResponse({ order_id: "oid1", status: "LIVE", size_matched: "0", size_remaining: "10", average_price: "0.60", fills: [] }));
    const getOrderResult = await polyGetOrder(makeTask({ order_id: "oid1" }));
    expect(getOrderResult).toHaveProperty("status", "LIVE");

    // 6. Cancel order
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    const cancelResult = await polyCancelOrder(makeTask({ order_id: "oid1" }, { api_credentials: creds }));
    expect(cancelResult).toEqual({ cancelled: true, order_id: "oid1" });
  });
});

describe("Integration: market data collection", () => {
  it("fetches price, midpoint, spread, tick size and neg risk for a token", async () => {
    const tokenId = "12345678901234567890";

    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.65" }));
    const priceResult = await polyGetPrice(makeTask({ token_id: tokenId })) as Record<string, unknown>;
    expect(priceResult.price).toBe(0.65);
    expect(priceResult.price_raw).toBe("0.65");

    mockFetch.mockResolvedValueOnce(jsonResponse({ midpoint: "0.6500" }));
    const midpointResult = await polyGetMidpoint(makeTask({ token_id: tokenId })) as Record<string, unknown>;
    expect(midpointResult.midpoint).toBe("0.6500");

    mockFetch.mockResolvedValueOnce(jsonResponse({ spread: "0.0200" }));
    const spreadResult = await polyGetSpread(makeTask({ token_id: tokenId })) as Record<string, unknown>;
    expect(spreadResult.spread).toBe("0.0200");

    mockFetch.mockResolvedValueOnce(jsonResponse({ tick_size: "0.01" }));
    const tickResult = await polyGetTickSize(makeTask({ token_id: tokenId })) as Record<string, unknown>;
    expect(tickResult.tick_size).toBe("0.01");

    mockFetch.mockResolvedValueOnce(jsonResponse({ neg_risk: false }));
    const negRiskResult = await polyGetNegRisk(makeTask({ token_id: tokenId })) as Record<string, unknown>;
    expect(negRiskResult.neg_risk).toBe(false);
  });
});

describe("Integration: account management", () => {
  it("fetches positions, balance, open orders and cancels all orders", async () => {
    const creds = validCreds;

    // Get positions
    const positions = { positions: [], total_value: "0", unrealized_pnl: "0" };
    mockFetch.mockResolvedValueOnce(jsonResponse(positions));
    const posResult = await polyGetPositions(makeTask({ account_address: "0xabc" }));
    expect(posResult).toEqual(positions);

    // Get balance
    const balance = { balance: "1000.0", allowance: "500.0", address: "0xabc" };
    mockFetch.mockResolvedValueOnce(jsonResponse(balance));
    const balResult = await polyGetBalance(makeTask({}, { api_credentials: creds }));
    expect(balResult).toEqual(balance);

    // Get open orders
    const orders = [
      { order_id: "o1", status: "LIVE", market_id: "m1", token_id: "12345678901234567890", side: "BUY", size: "10", price: "0.5", order_type: "GTC", created_at: "2025-01-01T00:00:00Z" },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(orders));
    const ordersResult = await polyGetOrders(makeTask({}, { api_credentials: creds }));
    expect(ordersResult).toEqual(orders);

    // Cancel all orders
    mockFetch.mockResolvedValueOnce(jsonResponse({ cancelled: [1] }));
    const cancelAllResult = await polyCancelAllOrders(makeTask({}, { api_credentials: creds }));
    expect(cancelAllResult).toEqual({ cancelled: true, count: 1 });
  });
});

describe("Integration: error handling across handlers", () => {
  it("handles rate limiting consistently across all handlers", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Too many requests",
    } as Response);

    const tasks = [
      { handler: () => polyGetOrder(makeTask({ order_id: "o1" })), name: "polyGetOrder" },
      { handler: () => polyGetMarket(makeTask({ market_id: "m1" })), name: "polyGetMarket" },
      { handler: () => polyGetOrderbook(makeTask({ token_id: "12345678901234567890" })), name: "polyGetOrderbook" },
      { handler: () => polyGetPrice(makeTask({ token_id: "12345678901234567890" })), name: "polyGetPrice" },
      { handler: () => polyGetMidpoint(makeTask({ token_id: "12345678901234567890" })), name: "polyGetMidpoint" },
      { handler: () => polyGetSpread(makeTask({ token_id: "12345678901234567890" })), name: "polyGetSpread" },
      { handler: () => polyGetTickSize(makeTask({ token_id: "12345678901234567890" })), name: "polyGetTickSize" },
      { handler: () => polyGetNegRisk(makeTask({ token_id: "12345678901234567890" })), name: "polyGetNegRisk" },
    ];

    for (const { handler, name } of tasks) {
      try {
        await handler();
        expect.fail(`${name} should have thrown`);
      } catch (e) {
        const err = e as PolymarketError;
        expect(err).toBeInstanceOf(PolymarketError);
        expect(err.code).toBe("RATE_LIMITED");
        expect(err.retryable).toBe(true);
      }
    }
  }, 60000);

  it("handles 404 not found across different resource types", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not found",
    } as Response);

    try {
      await polyGetOrder(makeTask({ order_id: "missing" }));
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("NOT_FOUND");
      expect(err.retryable).toBe(false);
    }

    try {
      await polyGetMarket(makeTask({ market_id: "missing" }));
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("NOT_FOUND");
    }
  });
});

describe("Integration: params validation", () => {
  it("rejects invalid params before making API calls", async () => {
    // These should throw without calling fetch
    const beforeCount = mockFetch.mock.calls.length;

    await expect(polyGetOrder(makeTask({}))).rejects.toThrow("order_id is required");
    await expect(polyGetOrderbook(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyGetMarket(makeTask({}))).rejects.toThrow("market_id is required");
    await expect(polyGetPositions(makeTask({}))).rejects.toThrow("account_address is required");
    await expect(polyGetPrice(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyGetMidpoint(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyGetSpread(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyGetTickSize(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyGetNegRisk(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyCancelOrder(makeTask({}))).rejects.toThrow("order_id is required");
    await expect(polyGetTrades(makeTask({}))).rejects.toThrow("token_id is required");
    await expect(polyGetOrders(makeTask({}))).rejects.toThrow("api_credentials missing from context");
    await expect(polyGetBalance(makeTask({}))).rejects.toThrow("api_credentials missing from context");
    await expect(polyCancelAllOrders(makeTask({}))).rejects.toThrow("api_credentials missing from context");

    expect(mockFetch.mock.calls.length).toBe(beforeCount);
  });
});
