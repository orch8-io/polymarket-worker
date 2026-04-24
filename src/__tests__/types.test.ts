import { describe, it, expect } from "vitest";
import {
  PolymarketError,
  POLYMARKET_V2_CONFIG,
  EIP712_DOMAIN,
  EIP712_ORDER_DOMAIN,
  ORDER_TYPES,
  AUTH_TYPES,
} from "../types.js";

describe("PolymarketError", () => {
  it("sets all properties correctly", () => {
    const err = new PolymarketError("test error", 400, false, "BAD_REQUEST");
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(400);
    expect(err.retryable).toBe(false);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.name).toBe("PolymarketError");
  });

  it("is an instance of Error", () => {
    const err = new PolymarketError("test", 500, true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PolymarketError);
  });

  it("code is optional", () => {
    const err = new PolymarketError("test", 500, true);
    expect(err.code).toBeUndefined();
  });

  it("has a stack trace", () => {
    const err = new PolymarketError("test", 500, true);
    expect(err.stack).toBeDefined();
  });
});

describe("constants", () => {
  it("POLYMARKET_V2_CONFIG has correct values", () => {
    expect(POLYMARKET_V2_CONFIG.clobBaseUrl).toBe("https://clob.polymarket.com");
    expect(POLYMARKET_V2_CONFIG.chainId).toBe(137);
    expect(POLYMARKET_V2_CONFIG.exchangeAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("EIP712_DOMAIN has correct structure", () => {
    expect(EIP712_DOMAIN.name).toBe("ClobAuthDomain");
    expect(EIP712_DOMAIN.version).toBe("2");
    expect(EIP712_DOMAIN.chainId).toBe(137);
  });

  it("EIP712_ORDER_DOMAIN has correct structure", () => {
    expect(EIP712_ORDER_DOMAIN.name).toBe("CTFExchange");
    expect(EIP712_ORDER_DOMAIN.version).toBe("2");
    expect(EIP712_ORDER_DOMAIN.chainId).toBe(137);
  });

  it("ORDER_TYPES has all required fields", () => {
    const fieldNames = ORDER_TYPES.Order.map((f) => f.name);
    expect(fieldNames).toEqual([
      "salt", "maker", "signer", "taker", "tokenId",
      "makerAmount", "takerAmount", "expiration", "signatureType",
    ]);
  });

  it("AUTH_TYPES has all required fields", () => {
    const fieldNames = AUTH_TYPES.ClobAuth.map((f) => f.name);
    expect(fieldNames).toEqual(["address", "timestamp", "nonce", "message"]);
  });
});
