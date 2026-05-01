import { createServer } from "node:http";
import { Orch8Worker, Orch8Client } from "@orch8.io/sdk";
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
  polyDiscoverMarkets,
  polyCheckResolution,
} from "./handlers/index.js";

const engineUrl = process.env.ORCH8_URL || "http://localhost:8080";
const workerId = `polymarket-worker-${process.env.HOSTNAME || "local"}`;
const healthPort = Number(process.env.HEALTH_PORT) || 9090;

// ── Structured logger ──────────────────────────────────────────────────────
function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = {
    time: new Date().toISOString(),
    level,
    worker: workerId,
    message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

// ── Health check server ────────────────────────────────────────────────────
let healthy = false;
const healthServer = createServer((req, res) => {
  if (req.url === "/health/live") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", worker: workerId }));
    return;
  }
  if (req.url === "/health/ready") {
    const status = healthy ? 200 : 503;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: healthy ? "ready" : "not_ready", worker: workerId }));
    return;
  }
  res.writeHead(404);
  res.end();
});

healthServer.listen(healthPort, () => {
  log("info", `Health server listening on port ${healthPort}`);
});

// ── Worker ─────────────────────────────────────────────────────────────────
const apiKey = process.env.ORCH8_API_KEY || "";
const client = new Orch8Client({
  baseUrl: engineUrl,
  ...(apiKey && { headers: { "x-api-key": apiKey } }),
});

const worker = new Orch8Worker({
  engineUrl,
  workerId,
  client,
  maxConcurrent: 50,
  circuitBreakerCheck: true,
  handlers: {
    poly_create_api_key: polyCreateApiKey,
    poly_place_order: polyPlaceOrder,
    poly_cancel_order: polyCancelOrder,
    poly_cancel_all_orders: polyCancelAllOrders,
    poly_get_order: polyGetOrder,
    poly_get_orders: polyGetOrders,
    poly_get_orderbook: polyGetOrderbook,
    poly_get_positions: polyGetPositions,
    poly_get_market: polyGetMarket,
    poly_get_price: polyGetPrice,
    poly_stream_prices: polyGetPrice, // backward compat alias
    poly_get_trades: polyGetTrades,
    poly_get_balance: polyGetBalance,
    poly_get_midpoint: polyGetMidpoint,
    poly_get_spread: polyGetSpread,
    poly_get_tick_size: polyGetTickSize,
    poly_get_neg_risk: polyGetNegRisk,
    poly_discover_markets: polyDiscoverMarkets,
    poly_check_resolution: polyCheckResolution,
  },
  onTaskComplete: (task, output) => {
    log("info", "Task completed", {
      handler: task.handler_name,
      task_id: task.id,
      attempt: task.attempt,
    });
  },
  onTaskFail: (task, error) => {
    log("error", "Task failed", {
      handler: task.handler_name,
      task_id: task.id,
      attempt: task.attempt,
      error: String(error),
    });
  },
});

log("info", "Starting polymarket worker", { engine_url: engineUrl });
await worker.start();
healthy = true;
log("info", "Worker ready");

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string) {
  log("info", `Shutting down (${signal})`);
  healthy = false;
  await worker.stop();
  healthServer.close(() => {
    log("info", "Health server closed");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
