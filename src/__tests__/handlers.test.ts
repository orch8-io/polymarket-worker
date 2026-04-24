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
  polyStreamPrices,
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

describe("polyCreateApiKey", () => {
  it("throws when private_key is missing", async () => {
    await expect(polyCreateApiKey(makeTask({}))).rejects.toThrow(PolymarketError);
    await expect(polyCreateApiKey(makeTask({}))).rejects.toThrow("private_key is required");
  });

  it("calls deriveApiKey with valid params", async () => {
    const creds = { api_key: "k", api_secret: "s", api_passphrase: "p" };
    mockFetch.mockResolvedValueOnce(jsonResponse(creds));
    const task = makeTask({ private_key: "0x" + "a".repeat(64) });
    const result = await polyCreateApiKey(task);
    expect(result).toEqual(creds);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/auth/derive-api-key");
    expect(opts.method).toBe("POST");
  });
});

describe("polyPlaceOrder", () => {
  it("throws when private_key missing from context", async () => {
    const task = makeTask(
      { token_id: "t1", side: "BUY", size: "10", price: "0.5" },
      { api_credentials: validCreds },
    );
    await expect(polyPlaceOrder(task)).rejects.toThrow("private_key missing from context");
  });

  it("throws when api_credentials missing from context", async () => {
    const task = makeTask(
      { token_id: "t1", side: "BUY", size: "10", price: "0.5" },
      { private_key: "0x" + "a".repeat(64) },
    );
    await expect(polyPlaceOrder(task)).rejects.toThrow("api_credentials missing from context");
  });

  it("throws when api_credentials partially present", async () => {
    const task = makeTask(
      { token_id: "t1", side: "BUY", size: "10", price: "0.5" },
      { private_key: "0x" + "a".repeat(64), api_credentials: { api_key: "k" } },
    );
    await expect(polyPlaceOrder(task)).rejects.toThrow("api_credentials missing from context");
  });

  it("throws when required params missing", async () => {
    const task = makeTask(
      { token_id: "t1" },
      { private_key: "0x" + "a".repeat(64), api_credentials: validCreds },
    );
    await expect(polyPlaceOrder(task)).rejects.toThrow("token_id, side, size, and price are required");
  });

  it("throws when token_id is missing", async () => {
    const task = makeTask(
      { side: "BUY", size: "10", price: "0.5" },
      { private_key: "0x" + "a".repeat(64), api_credentials: validCreds },
    );
    await expect(polyPlaceOrder(task)).rejects.toThrow("token_id, side, size, and price are required");
  });
});

describe("polyCancelOrder", () => {
  it("throws when order_id is missing", async () => {
    const task = makeTask({}, { api_credentials: validCreds });
    await expect(polyCancelOrder(task)).rejects.toThrow("order_id is required");
  });

  it("throws when api_credentials missing", async () => {
    const task = makeTask({ order_id: "o1" });
    await expect(polyCancelOrder(task)).rejects.toThrow("api_credentials missing from context");
  });

  it("succeeds with valid params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    const task = makeTask({ order_id: "o1" }, { api_credentials: validCreds });
    const result = await polyCancelOrder(task);
    expect(result).toEqual({ cancelled: true, order_id: "o1" });
  });
});

describe("polyGetOrder", () => {
  it("throws when order_id is missing", async () => {
    await expect(polyGetOrder(makeTask({}))).rejects.toThrow("order_id is required");
  });

  it("returns order detail", async () => {
    const order = { order_id: "o1", status: "LIVE", size_matched: "0", size_remaining: "10", average_price: "0.5", fills: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(order));
    const result = await polyGetOrder(makeTask({ order_id: "o1" }));
    expect(result).toEqual(order);
  });
});

describe("polyGetOrderbook", () => {
  it("throws when token_id is missing", async () => {
    await expect(polyGetOrderbook(makeTask({}))).rejects.toThrow("token_id is required");
  });

  it("returns enriched orderbook", async () => {
    const rawBook = {
      bids: [{ price: "0.45", size: "100" }],
      asks: [{ price: "0.55", size: "100" }],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(rawBook));
    const result = await polyGetOrderbook(makeTask({ token_id: "t1" })) as Record<string, unknown>;
    expect(result).toHaveProperty("spread");
    expect(result).toHaveProperty("mid_price");
  });
});

describe("polyGetPositions", () => {
  it("throws when account_address is missing", async () => {
    await expect(polyGetPositions(makeTask({}))).rejects.toThrow("account_address is required");
  });

  it("returns positions", async () => {
    const positions = { positions: [], total_value: "0", unrealized_pnl: "0" };
    mockFetch.mockResolvedValueOnce(jsonResponse(positions));
    const result = await polyGetPositions(makeTask({ account_address: "0xabc" }));
    expect(result).toEqual(positions);
  });
});

describe("polyGetMarket", () => {
  it("throws when market_id is missing", async () => {
    await expect(polyGetMarket(makeTask({}))).rejects.toThrow("market_id is required");
  });

  it("returns market data", async () => {
    const market = {
      condition_id: "c1",
      question: "Test?",
      tokens: [],
      volume: "0",
      liquidity: "0",
      end_date: "2025-12-31",
      active: true,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(market));
    const result = await polyGetMarket(makeTask({ market_id: "m1" }));
    expect(result).toEqual(market);
  });
});

describe("polyStreamPrices", () => {
  it("throws when token_id is missing", async () => {
    await expect(polyStreamPrices(makeTask({}))).rejects.toThrow("token_id is required");
  });

  it("returns price without threshold", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.65" }));
    const result = await polyStreamPrices(makeTask({ token_id: "t1" })) as Record<string, unknown>;
    expect(result).toHaveProperty("price", "0.65");
    expect(result).toHaveProperty("threshold_triggered", false);
    expect(result).toHaveProperty("trigger_direction", null);
  });

  it("triggers above threshold", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.80" }));
    const task = makeTask({
      token_id: "t1",
      price_threshold: { above: "0.75" },
    });
    const result = await polyStreamPrices(task) as Record<string, unknown>;
    expect(result).toHaveProperty("threshold_triggered", true);
    expect(result).toHaveProperty("trigger_direction", "above");
  });

  it("triggers below threshold", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.20" }));
    const task = makeTask({
      token_id: "t1",
      price_threshold: { below: "0.25" },
    });
    const result = await polyStreamPrices(task) as Record<string, unknown>;
    expect(result).toHaveProperty("threshold_triggered", true);
    expect(result).toHaveProperty("trigger_direction", "below");
  });

  it("does not trigger when price is within thresholds", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.50" }));
    const task = makeTask({
      token_id: "t1",
      price_threshold: { above: "0.75", below: "0.25" },
    });
    const result = await polyStreamPrices(task) as Record<string, unknown>;
    expect(result).toHaveProperty("threshold_triggered", false);
    expect(result).toHaveProperty("trigger_direction", null);
  });

  it("below threshold takes precedence when both trigger", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.10" }));
    const task = makeTask({
      token_id: "t1",
      price_threshold: { above: "0.05", below: "0.25" },
    });
    const result = await polyStreamPrices(task) as Record<string, unknown>;
    expect(result).toHaveProperty("threshold_triggered", true);
    expect(result).toHaveProperty("trigger_direction", "below");
  });
});

describe("polyGetTrades", () => {
  it("throws when token_id is missing", async () => {
    const task = makeTask({}, { api_credentials: validCreds });
    await expect(polyGetTrades(task)).rejects.toThrow("token_id is required");
  });

  it("throws when api_credentials missing", async () => {
    const task = makeTask({ token_id: "t1" });
    await expect(polyGetTrades(task)).rejects.toThrow("api_credentials missing from context");
  });

  it("returns trades", async () => {
    const trades = [{ price: "0.5", size: "10", side: "BUY", timestamp: "2025-01-01T00:00:00Z", transaction_hash: "0xabc" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(trades));
    const task = makeTask({ token_id: "t1" }, { api_credentials: validCreds });
    const result = await polyGetTrades(task);
    expect(result).toEqual(trades);
  });

  it("passes optional params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    const task = makeTask(
      { token_id: "t1", limit: 25, before: "cur1", after: "cur2" },
      { api_credentials: validCreds },
    );
    await polyGetTrades(task);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=25");
    expect(url).toContain("before=cur1");
    expect(url).toContain("after=cur2");
  });
});

describe("polyCancelAllOrders", () => {
  it("throws when api_credentials missing", async () => {
    await expect(polyCancelAllOrders(makeTask({}))).rejects.toThrow("api_credentials missing from context");
  });

  it("succeeds with valid params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ cancelled: [1, 2] }));
    const task = makeTask({}, { api_credentials: validCreds });
    const result = await polyCancelAllOrders(task);
    expect(result).toEqual({ cancelled: true, count: 2 });
  });

  it("passes market filter", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ cancelled: [] }));
    const task = makeTask({ market: "m1" }, { api_credentials: validCreds });
    await polyCancelAllOrders(task);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("market=m1");
  });
});

describe("polyGetOrders", () => {
  it("throws when api_credentials missing", async () => {
    await expect(polyGetOrders(makeTask({}))).rejects.toThrow("api_credentials missing from context");
  });

  it("returns open orders", async () => {
    const orders = [{ order_id: "o1", status: "LIVE", market_id: "m1", token_id: "t1", side: "BUY", size: "10", price: "0.5", order_type: "GTC", created_at: "2025-01-01T00:00:00Z" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(orders));
    const task = makeTask({}, { api_credentials: validCreds });
    const result = await polyGetOrders(task);
    expect(result).toEqual(orders);
  });

  it("passes asset_id filter", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    const task = makeTask({ asset_id: "t1" }, { api_credentials: validCreds });
    await polyGetOrders(task);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("asset_id=t1");
  });
});

describe("polyGetBalance", () => {
  it("throws when api_credentials missing", async () => {
    await expect(polyGetBalance(makeTask({}))).rejects.toThrow("api_credentials missing from context");
  });

  it("returns balance", async () => {
    const balance = { balance: "1000.0", allowance: "500.0", address: "0xabc" };
    mockFetch.mockResolvedValueOnce(jsonResponse(balance));
    const task = makeTask({}, { api_credentials: validCreds });
    const result = await polyGetBalance(task);
    expect(result).toEqual(balance);
  });

  it("passes address param", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ balance: "0", allowance: "0", address: "0xdef" }));
    const task = makeTask({ address: "0xdef" }, { api_credentials: validCreds });
    await polyGetBalance(task);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/balance/0xdef");
  });
});

describe("polyGetMidpoint", () => {
  it("throws when token_id is missing", async () => {
    await expect(polyGetMidpoint(makeTask({}))).rejects.toThrow("token_id is required");
  });

  it("returns midpoint", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ midpoint: "0.5000" }));
    const result = await polyGetMidpoint(makeTask({ token_id: "t1" })) as Record<string, unknown>;
    expect(result).toHaveProperty("midpoint", "0.5000");
    expect(result).toHaveProperty("token_id", "t1");
  });
});

describe("polyGetSpread", () => {
  it("throws when token_id is missing", async () => {
    await expect(polyGetSpread(makeTask({}))).rejects.toThrow("token_id is required");
  });

  it("returns spread", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ spread: "0.0200" }));
    const result = await polyGetSpread(makeTask({ token_id: "t1" })) as Record<string, unknown>;
    expect(result).toHaveProperty("spread", "0.0200");
    expect(result).toHaveProperty("token_id", "t1");
  });
});

describe("polyGetTickSize", () => {
  it("throws when token_id is missing", async () => {
    await expect(polyGetTickSize(makeTask({}))).rejects.toThrow("token_id is required");
  });

  it("returns tick size", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ tick_size: "0.01" }));
    const result = await polyGetTickSize(makeTask({ token_id: "t1" })) as Record<string, unknown>;
    expect(result).toHaveProperty("tick_size", "0.01");
    expect(result).toHaveProperty("token_id", "t1");
  });
});

describe("polyGetNegRisk", () => {
  it("throws when token_id is missing", async () => {
    await expect(polyGetNegRisk(makeTask({}))).rejects.toThrow("token_id is required");
  });

  it("returns neg risk flag", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ neg_risk: true }));
    const result = await polyGetNegRisk(makeTask({ token_id: "t1" })) as Record<string, unknown>;
    expect(result).toHaveProperty("neg_risk", true);
    expect(result).toHaveProperty("token_id", "t1");
  });
});

describe("handler error propagation", () => {
  it("propagates API errors from client", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    } as Response);
    const task = makeTask({ order_id: "o1" });
    try {
      await polyGetOrder(task);
    } catch (e) {
      const err = e as PolymarketError;
      expect(err).toBeInstanceOf(PolymarketError);
      expect(err.retryable).toBe(true);
      expect(err.code).toBe("RATE_LIMITED");
    }
  });

  it("propagates 500 server errors as retryable", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "internal error",
    } as Response);
    const task = makeTask({ market_id: "m1" });
    try {
      await polyGetMarket(task);
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.retryable).toBe(true);
      expect(err.statusCode).toBe(500);
    }
  });
});
