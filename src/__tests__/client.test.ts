import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PolymarketClient } from "../client.js";
import { PolymarketError, POLYMARKET_V2_CONFIG } from "../types.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.POLYMARKET_CLOB_URL;
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
    json: async () => data,
  } as Response;
}

function errorResponse(body: string, status: number): Response {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response;
}

describe("PolymarketClient constructor", () => {
  it("uses default config", () => {
    const client = new PolymarketClient();
    // Verify by making a call and checking the URL
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.5" }));
    client.getPrice("token123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://clob.polymarket.com"),
    );
  });

  it("accepts custom config override", () => {
    const client = new PolymarketClient({ clobBaseUrl: "https://custom.api.com" });
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.5" }));
    client.getPrice("token123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://custom.api.com"),
    );
  });

  it("reads POLYMARKET_CLOB_URL env var", () => {
    process.env.POLYMARKET_CLOB_URL = "https://env.api.com";
    const client = new PolymarketClient();
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.5" }));
    client.getPrice("token123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://env.api.com"),
    );
  });

  it("explicit config overrides env var", () => {
    process.env.POLYMARKET_CLOB_URL = "https://env.api.com";
    const client = new PolymarketClient({ clobBaseUrl: "https://explicit.api.com" });
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.5" }));
    client.getPrice("token123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://explicit.api.com"),
    );
  });
});

describe("error classification (via API responses)", () => {
  const client = new PolymarketClient();

  it("classifies 400 insufficient balance as non-retryable", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Insufficient balance for order", 400));
    await expect(client.getOrder("abc")).rejects.toThrow(PolymarketError);
    try {
      await client.getOrder("abc");
    } catch (e) {
      // Already thrown above — verify classification via fresh call
    }
    mockFetch.mockResolvedValueOnce(errorResponse("Insufficient balance for order", 400));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.statusCode).toBe(400);
      expect(err.retryable).toBe(false);
      expect(err.code).toBe("INSUFFICIENT_BALANCE");
    }
  });

  it("classifies 400 order too small as non-retryable", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Order size too small", 400));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("ORDER_TOO_SMALL");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 400 minimum as ORDER_TOO_SMALL", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Below minimum order size", 400));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("ORDER_TOO_SMALL");
    }
  });

  it("classifies 400 invalid signature as non-retryable", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Invalid signature provided", 400));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("INVALID_SIGNATURE");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 400 expired as non-retryable", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Order expired", 400));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("ORDER_EXPIRED");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies generic 400 as BAD_REQUEST", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Something went wrong", 400));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 401 as UNAUTHORIZED", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Unauthorized", 401));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 403 as FORBIDDEN", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Forbidden", 403));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("FORBIDDEN");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 404 as NOT_FOUND", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Not found", 404));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("NOT_FOUND");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 409 as CONFLICT", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Conflict", 409));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("CONFLICT");
      expect(err.retryable).toBe(false);
    }
  });

  it("classifies 429 as retryable RATE_LIMITED", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Too many requests", 429));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("RATE_LIMITED");
      expect(err.retryable).toBe(true);
    }
  });

  it("classifies 500 as retryable SERVER_ERROR", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Internal server error", 500));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("SERVER_ERROR");
      expect(err.retryable).toBe(true);
    }
  });

  it("classifies 502 as retryable SERVER_ERROR", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Bad gateway", 502));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("SERVER_ERROR");
      expect(err.retryable).toBe(true);
    }
  });

  it("classifies unknown status as UNKNOWN non-retryable", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse("Teapot", 418));
    try {
      await client.getOrder("abc");
    } catch (e) {
      const err = e as PolymarketError;
      expect(err.code).toBe("UNKNOWN");
      expect(err.retryable).toBe(false);
    }
  });
});

describe("getOrder", () => {
  const client = new PolymarketClient();

  it("returns order detail on success", async () => {
    const order = {
      order_id: "abc",
      status: "LIVE",
      size_matched: "0",
      size_remaining: "10",
      average_price: "0.55",
      fills: [],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(order));
    const result = await client.getOrder("abc");
    expect(result).toEqual(order);
    expect(mockFetch).toHaveBeenCalledWith(
      `${POLYMARKET_V2_CONFIG.clobBaseUrl}/order/abc`,
    );
  });
});

describe("getOrderbook", () => {
  const client = new PolymarketClient();

  it("calculates spread and mid_price", async () => {
    const rawBook = {
      bids: [{ price: "0.45", size: "100" }, { price: "0.40", size: "50" }],
      asks: [{ price: "0.55", size: "100" }, { price: "0.60", size: "50" }],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(rawBook));
    const result = await client.getOrderbook("token123");
    expect(result.spread).toBe("0.1000");
    expect(result.mid_price).toBe("0.5000");
    expect(result.bids).toEqual(rawBook.bids);
    expect(result.asks).toEqual(rawBook.asks);
    expect(result.timestamp).toBeDefined();
  });

  it("handles empty orderbook", async () => {
    const rawBook = { bids: [], asks: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(rawBook));
    const result = await client.getOrderbook("token123");
    expect(result.spread).toBe("1.0000");
    expect(result.mid_price).toBe("0.5000");
  });

  it("handles one-sided orderbook (bids only)", async () => {
    const rawBook = { bids: [{ price: "0.45", size: "100" }], asks: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(rawBook));
    const result = await client.getOrderbook("token123");
    expect(result.spread).toBe("0.5500");
    expect(result.mid_price).toBe("0.7250");
  });
});

describe("getPrice", () => {
  const client = new PolymarketClient();

  it("returns price string", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ price: "0.73" }));
    const result = await client.getPrice("token123");
    expect(result).toBe("0.73");
  });
});

describe("getPositions", () => {
  const client = new PolymarketClient();

  it("returns positions result", async () => {
    const positions = {
      positions: [{ market_id: "m1", token_id: "t1", size: "10", average_entry: "0.5", current_price: "0.6", pnl: "1.0", pnl_percent: "20" }],
      total_value: "6.0",
      unrealized_pnl: "1.0",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(positions));
    const result = await client.getPositions("0xabc");
    expect(result).toEqual(positions);
    expect(mockFetch).toHaveBeenCalledWith(
      `${POLYMARKET_V2_CONFIG.clobBaseUrl}/positions?address=0xabc`,
    );
  });
});

describe("getMarket", () => {
  const client = new PolymarketClient();

  it("returns market result", async () => {
    const market = {
      condition_id: "cid",
      question: "Will X happen?",
      tokens: [{ token_id: "t1", outcome: "Yes", price: "0.7" }],
      volume: "1000000",
      liquidity: "50000",
      end_date: "2025-12-31",
      active: true,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(market));
    const result = await client.getMarket("market123");
    expect(result).toEqual(market);
    expect(mockFetch).toHaveBeenCalledWith(
      `${POLYMARKET_V2_CONFIG.clobBaseUrl}/markets/market123`,
    );
  });
});

describe("cancelOrder", () => {
  const client = new PolymarketClient();
  const creds = {
    api_key: "key123",
    api_secret: Buffer.from("secret").toString("base64"),
    api_passphrase: "pass123",
  };

  it("returns cancelled result", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    const result = await client.cancelOrder("order456", creds);
    expect(result).toEqual({ cancelled: true, order_id: "order456" });
  });

  it("sends DELETE with HMAC headers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
    await client.cancelOrder("order456", creds);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/order");
    expect(opts.method).toBe("DELETE");
    expect(opts.headers).toHaveProperty("POLY_API_KEY", "key123");
    expect(opts.headers).toHaveProperty("POLY_PASSPHRASE", "pass123");
    expect(opts.headers).toHaveProperty("POLY_SIGNATURE");
    expect(opts.headers).toHaveProperty("POLY_TIMESTAMP");
  });
});

describe("getTrades", () => {
  const client = new PolymarketClient();
  const creds = {
    api_key: "key123",
    api_secret: Buffer.from("secret").toString("base64"),
    api_passphrase: "pass123",
  };

  it("returns trades array", async () => {
    const trades = [
      { price: "0.5", size: "10", side: "BUY", timestamp: "2025-01-01T00:00:00Z", transaction_hash: "0xabc" },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(trades));
    const result = await client.getTrades("token123", creds);
    expect(result).toEqual(trades);
  });

  it("passes query params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.getTrades("token123", creds, { limit: 50, before: "cursor1" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("token_id=token123");
    expect(url).toContain("limit=50");
    expect(url).toContain("before=cursor1");
  });

  it("sends HMAC headers for authenticated request", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.getTrades("token123", creds);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers).toHaveProperty("POLY_API_KEY", "key123");
    expect(opts.headers).toHaveProperty("POLY_SIGNATURE");
  });
});

describe("HMAC header structure", () => {
  const client = new PolymarketClient();
  const creds = {
    api_key: "testkey",
    api_secret: Buffer.from("testsecret").toString("base64"),
    api_passphrase: "testpass",
  };

  it("includes all required POLY_ headers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.getTrades("token1", creds);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.POLY_API_KEY).toBe("testkey");
    expect(headers.POLY_PASSPHRASE).toBe("testpass");
    expect(headers.POLY_TIMESTAMP).toMatch(/^\d+$/);
    expect(headers.POLY_SIGNATURE).toMatch(/^0x[0-9a-f]+$/);
    expect(headers.POLY_ADDRESS).toBeDefined();
  });

  it("HMAC signature changes with different timestamps", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(1000000);
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.getTrades("token1", creds);
    const sig1 = mockFetch.mock.calls[0][1].headers.POLY_SIGNATURE;

    now.mockReturnValueOnce(2000000);
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.getTrades("token1", creds);
    const sig2 = mockFetch.mock.calls[1][1].headers.POLY_SIGNATURE;

    expect(sig1).not.toBe(sig2);
    now.mockRestore();
  });
});
