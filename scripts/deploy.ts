/**
 * Deploy the signal-bettor sequence to the orch8 engine.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts
 *
 * Environment:
 *   ORCH8_URL      — Engine URL (default: http://localhost:8080)
 *   OPENAI_API_KEY — Required for LLM research step
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ORCH8_URL = process.env.ORCH8_URL ?? "http://localhost:8080";
const TENANT_ID = process.env.ORCH8_TENANT_ID ?? "default";
const NAMESPACE = process.env.ORCH8_NAMESPACE ?? "default";

const sequencePath = resolve(__dirname, "../examples/signal-bettor.json");
const sequenceDef = JSON.parse(readFileSync(sequencePath, "utf-8"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
if (!OPENAI_API_KEY) {
  console.warn("⚠  OPENAI_API_KEY not set — LLM research step will fail at runtime");
}

// Inject the API key into the llm_call step params
for (const block of sequenceDef.blocks) {
  if (block.id === "research" && block.handler === "llm_call") {
    block.params.api_key = OPENAI_API_KEY;
    break;
  }
}

const payload = {
  id: crypto.randomUUID(),
  tenant_id: TENANT_ID,
  namespace: NAMESPACE,
  name: sequenceDef.name,
  version: sequenceDef.version,
  created_at: new Date().toISOString(),
  blocks: sequenceDef.blocks,
};

console.log(`Deploying ${payload.name} v${payload.version} to ${ORCH8_URL}...`);

const res = await fetch(`${ORCH8_URL}/sequences`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Deploy failed: ${res.status} ${body}`);
  process.exit(1);
}

const result = await res.json();
console.log(`Deployed: ${payload.name} (id: ${result.id ?? payload.id})`);
console.log(`\nNext: run a bet with:`);
console.log(`  npx tsx scripts/bet.ts <condition-id>`);
