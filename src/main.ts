import { Orch8Worker } from "@orch8.io/sdk";
import {
  polyCreateApiKey,
  polyPlaceOrder,
  polyCancelOrder,
  polyGetOrder,
  polyGetOrderbook,
  polyGetPositions,
  polyGetMarket,
  polyStreamPrices,
  polyGetTrades,
} from "./handlers/index.js";

const engineUrl = process.env.ORCH8_URL || "http://localhost:8080";
const workerId = `polymarket-worker-${process.env.HOSTNAME || "local"}`;

const worker = new Orch8Worker({
  engineUrl,
  workerId,
  maxConcurrent: 50,
  circuitBreakerCheck: true,
  handlers: {
    poly_create_api_key: polyCreateApiKey,
    poly_place_order: polyPlaceOrder,
    poly_cancel_order: polyCancelOrder,
    poly_get_order: polyGetOrder,
    poly_get_orderbook: polyGetOrderbook,
    poly_get_positions: polyGetPositions,
    poly_get_market: polyGetMarket,
    poly_stream_prices: polyStreamPrices,
    poly_get_trades: polyGetTrades,
  },
  onTaskComplete: (task, output) => {
    console.log(`[OK] ${task.handler_name} task=${task.id}`);
  },
  onTaskFail: (task, error) => {
    console.error(`[FAIL] ${task.handler_name} task=${task.id}: ${error}`);
  },
});

console.log(`Starting polymarket-worker (${workerId}) → ${engineUrl}`);
await worker.start();

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await worker.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await worker.stop();
  process.exit(0);
});
