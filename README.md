# @orch8/polymarket-worker

Polymarket V2 CLOB connector for the Orch8 workflow engine. Enables prediction market trading through declarative workflow tasks.

## Setup

```bash
pnpm install
pnpm build
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ORCH8_URL` | No | `http://localhost:8080` | Orch8 engine URL |
| `HOSTNAME` | No | `local` | Worker instance identifier |
| `POLYMARKET_CLOB_URL` | No | `https://clob.polymarket.com` | Override CLOB API base URL |

## Running

```bash
pnpm start
```

The worker connects to the Orch8 engine and polls for tasks matching its registered handler names. It runs up to 50 concurrent tasks.

## Handlers

All handlers receive a `WorkerTask` from the Orch8 engine with `params` and `context` fields.

| Handler | Description | Required Params | Required Context |
|---|---|---|---|
| `poly_create_api_key` | Derive API credentials from a private key | `private_key` | - |
| `poly_place_order` | Place a limit order on Polymarket | `token_id`, `side`, `size`, `price`, `order_type` | `private_key`, `api_credentials` |
| `poly_cancel_order` | Cancel an existing order | `order_id` | `api_credentials` |
| `poly_cancel_all_orders` | Cancel all open orders | - | `api_credentials` |
| `poly_get_order` | Get order status and fill details | `order_id` | - |
| `poly_get_orders` | List open orders | - | `api_credentials` |
| `poly_get_orderbook` | Get orderbook with spread/mid-price | `token_id` | - |
| `poly_get_positions` | Get account positions | `account_address` | - |
| `poly_get_market` | Get market details and token prices | `market_id` | - |
| `poly_get_price` | Get current token price | `token_id` | - |
| `poly_stream_prices` | Check price against thresholds (alias) | `token_id` | - |
| `poly_get_trades` | Get trade history for a token | `token_id` | `api_credentials` |
| `poly_get_balance` | Get balance and allowance | `address` (optional) | `api_credentials` |
| `poly_get_midpoint` | Get midpoint price | `token_id` | - |
| `poly_get_spread` | Get bid-ask spread | `token_id` | - |
| `poly_get_tick_size` | Get market tick size | `token_id` | - |
| `poly_get_neg_risk` | Check negative risk flag | `token_id` | - |

### Context Fields

Some handlers require secrets passed via workflow context (not params):

```typescript
// api_credentials — required for authenticated endpoints
{
  api_key: string;
  api_secret: string;     // base64-encoded
  api_passphrase: string;
}

// private_key — required for order signing
"0x..."  // Ethereum private key (hex)
```

### Handler Details

#### `poly_create_api_key`

Derives Polymarket API credentials by signing an EIP-712 message with the provided private key.

```json
{ "private_key": "0xabc..." }
```

Returns: `{ api_key, api_secret, api_passphrase }`

#### `poly_place_order`

Places a limit order. Signs the order using EIP-712 typed data and submits via HMAC-authenticated endpoint.

```json
{
  "token_id": "12345",
  "side": "BUY",
  "size": "10",
  "price": "0.55",
  "order_type": "GTC",
  "expiration": 1735689600,
  "builder_code": "optional-builder"
}
```

Order types: `GTC` (good-til-cancelled), `GTD` (good-til-date, requires `expiration`), `FOK` (fill-or-kill).

Returns: `{ order_id, status, size_matched, price, timestamp, transaction_hash? }`

#### `poly_stream_prices`

Fetches the current price and checks against optional thresholds. Despite the name, this is a single price check, not a streaming connection. Use it in a polling workflow loop for price monitoring.

```json
{
  "token_id": "12345",
  "price_threshold": {
    "above": "0.75",
    "below": "0.25"
  }
}
```

Returns: `{ price, timestamp, threshold_triggered, trigger_direction }`

### Error Handling

All handlers throw `PolymarketError` with structured error information:

| Code | Status | Retryable | Description |
|---|---|---|---|
| `INSUFFICIENT_BALANCE` | 400 | No | Not enough funds |
| `ORDER_TOO_SMALL` | 400 | No | Below minimum order size |
| `INVALID_SIGNATURE` | 400 | No | EIP-712 signature invalid |
| `ORDER_EXPIRED` | 400 | No | Order past expiration |
| `BAD_REQUEST` | 400 | No | Generic client error |
| `UNAUTHORIZED` | 401 | No | Invalid API credentials |
| `FORBIDDEN` | 403 | No | API key revoked |
| `NOT_FOUND` | 404 | No | Resource not found |
| `CONFLICT` | 409 | No | Order already exists |
| `RATE_LIMITED` | 429 | Yes | Back off and retry |
| `SERVER_ERROR` | 5xx | Yes | Polymarket server error |

The Orch8 engine uses the `retryable` flag to decide whether to retry failed tasks.

## Example Workflow

A typical trading workflow using these handlers:

```
1. poly_create_api_key     → derive credentials
2. poly_get_market          → find token IDs and prices
3. poly_get_orderbook       → check liquidity and spread
4. poly_place_order         → submit order
5. poly_get_order           → poll for fill status
6. poly_stream_prices       → monitor position (in loop)
```

## Architecture

```
Orch8 Engine ←→ polymarket-worker ←→ Polymarket CLOB API
                     │
                     ├── handlers/     (17 task handlers)
                     ├── client.ts     (API client, signing, HMAC auth)
                     └── types.ts      (EIP-712 constants, interfaces)
```

- **Handlers** validate params/context and delegate to `PolymarketClient`
- **PolymarketClient** handles API calls, EIP-712 order signing, and HMAC authentication
- **Error classification** maps HTTP status codes to structured `PolymarketError` with retry semantics

## Testing

```bash
pnpm test
pnpm test:watch
```

### Test Suite Overview

This package is tested as part of the full Orch8 stack:

| Layer | Tests | Scope |
|---|---|---|
| Rust unit + integration | 1,255 | Storage backends, evaluator, scheduler, handlers, config parsing, state machine transitions, gRPC auth, full engine integration |
| TypeScript E2E | 773 | 202 test files hitting the live HTTP API — sequences, instances, workers, cron, triggers, webhooks, approvals, sessions, plugins, credentials, pools, cluster, SSE streaming |

**Polymarket-worker exact test count — 109 total**

| Suite | Tests | Focus |
|---|---|---|
| `types.test.ts` | 9 | Constants, error types, EIP-712 schemas |
| `client.test.ts` | 47 | HTTP client, retry logic, HMAC auth, error classification, all API methods |
| `handlers.test.ts` | 47 | Param validation, context checks, handler-to-client delegation |
| `integration.test.ts` | 6 | End-to-end workflows, cross-handler error propagation, full trading flows |

**Total: 109 tests** — verified via `vitest run`.

## License

BUSL-1.1
