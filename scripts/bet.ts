/**
 * Create a signal-bettor instance for a specific Polymarket market.
 *
 * Usage:
 *   npx tsx scripts/bet.ts <condition-id> [--size 10] [--auto]
 *
 * Arguments:
 *   condition-id  — The Polymarket condition ID (from the market URL or Gamma API)
 *   --size N      — Bet size in USDC (default: 5)
 *   --auto        — Skip human approval gate (send auto-approve signal)
 *
 * Environment:
 *   ORCH8_URL          — Engine URL (default: http://localhost:8080)
 *   POLY_PRIVATE_KEY   — Polygon wallet private key (required)
 *   POLY_API_KEY       — Polymarket API key \
 *   POLY_API_SECRET    — Polymarket API secret  } (optional: auto-derived from private key if missing)
 *   POLY_API_PASSPHRASE — Polymarket API passphrase /
 *
 * To find a condition ID:
 *   curl 'https://gamma-api.polymarket.com/events?active=true&limit=5' | jq '.[].markets[].conditionId'
 */
import { ethers } from "ethers";

const ORCH8_URL = process.env.ORCH8_URL ?? "http://localhost:8080";

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const conditionId = args.find((a) => !a.startsWith("--"));
const betSize = args.includes("--size")
  ? args[args.indexOf("--size") + 1]
  : "5";
const autoApprove = args.includes("--auto");

if (!conditionId) {
  console.error("Usage: npx tsx scripts/bet.ts <condition-id> [--size N] [--auto]");
  console.error("\nTo find active markets:");
  console.error("  curl 'https://gamma-api.polymarket.com/events?active=true&limit=5' | jq '.[].markets[].conditionId'");
  process.exit(1);
}

// ── Resolve credentials ───────────────────────────────────────────────────────

const privateKey = process.env.POLY_PRIVATE_KEY;
if (!privateKey) {
  console.error("POLY_PRIVATE_KEY is required. Set it in your environment.");
  process.exit(1);
}

const wallet = new ethers.Wallet(privateKey);
console.log(`Wallet: ${wallet.address}`);

let apiCreds: { api_key: string; api_secret: string; api_passphrase: string };

if (process.env.POLY_API_KEY && process.env.POLY_API_SECRET && process.env.POLY_API_PASSPHRASE) {
  apiCreds = {
    api_key: process.env.POLY_API_KEY,
    api_secret: process.env.POLY_API_SECRET,
    api_passphrase: process.env.POLY_API_PASSPHRASE,
  };
  console.log("Using API credentials from environment");
} else {
  console.log("Deriving API credentials from private key...");
  const EIP712_DOMAIN = {
    name: "ClobAuthDomain",
    version: "2",
    chainId: 137,
    verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  };
  const AUTH_TYPES = {
    ClobAuth: [
      { name: "address", type: "address" },
      { name: "timestamp", type: "string" },
      { name: "nonce", type: "uint256" },
      { name: "message", type: "string" },
    ],
  };
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await wallet.signTypedData(EIP712_DOMAIN, AUTH_TYPES, {
    address: wallet.address,
    timestamp,
    nonce: 0,
    message: "This message attests that I control the given wallet",
  });

  const res = await fetch("https://clob.polymarket.com/auth/derive-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: wallet.address, signature, timestamp, nonce: 0 }),
  });

  if (!res.ok) {
    console.error(`Failed to derive API key: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  apiCreds = (await res.json()) as typeof apiCreds;
  console.log("API credentials derived successfully");
}

// ── Preview market ────────────────────────────────────────────────────────────

console.log(`\nFetching market ${conditionId}...`);
const marketRes = await fetch(`https://clob.polymarket.com/markets/${conditionId}`);
if (!marketRes.ok) {
  console.error(`Market not found: ${marketRes.status}`);
  process.exit(1);
}

const market = (await marketRes.json()) as {
  condition_id: string;
  question: string;
  tokens: Array<{ token_id: string; outcome: string; price: string }>;
  volume: string;
  end_date: string;
  active: boolean;
};

console.log(`\n  Question: ${market.question}`);
console.log(`  Active:   ${market.active}`);
console.log(`  End date: ${market.end_date}`);
console.log(`  Volume:   $${market.volume}`);
if (market.tokens[0]) console.log(`  YES:      ${market.tokens[0].price} (${market.tokens[0].token_id.slice(0, 16)}...)`);
if (market.tokens[1]) console.log(`  NO:       ${market.tokens[1].price} (${market.tokens[1].token_id.slice(0, 16)}...)`);
console.log(`  Bet size: $${betSize}`);
console.log(`  Auto:     ${autoApprove}`);

if (!market.active) {
  console.error("\nMarket is not active. Aborting.");
  process.exit(1);
}

// ── Find sequence ─────────────────────────────────────────────────────────────

console.log(`\nLooking up sequence...`);
const seqRes = await fetch(
  `${ORCH8_URL}/sequences?name=polymarket-signal-bettor&tenant_id=polymarket&namespace=default`,
);

if (!seqRes.ok) {
  console.error(`Failed to find sequence: ${seqRes.status} ${await seqRes.text()}`);
  console.error("Did you run: npx tsx scripts/deploy.ts");
  process.exit(1);
}

const sequences = (await seqRes.json()) as Array<{ id: string; name: string; version: number }>;
if (sequences.length === 0) {
  console.error("Sequence not found. Deploy first: npx tsx scripts/deploy.ts");
  process.exit(1);
}

const seq = sequences[sequences.length - 1];
console.log(`Using sequence: ${seq.name} v${seq.version} (${seq.id})`);

// ── Create instance ───────────────────────────────────────────────────────────

const instance = {
  sequence_id: seq.id,
  tenant_id: "polymarket",
  namespace: "default",
  context: {
    data: {
      condition_id: conditionId,
      bet_size: betSize,
      account_address: wallet.address,
    },
    config: {
      private_key: privateKey,
      api_credentials: apiCreds,
    },
  },
};

console.log(`\nCreating instance...`);
const instRes = await fetch(`${ORCH8_URL}/instances`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(instance),
});

if (!instRes.ok) {
  console.error(`Failed to create instance: ${instRes.status} ${await instRes.text()}`);
  process.exit(1);
}

const inst = (await instRes.json()) as { id: string; state: string };
console.log(`Instance created: ${inst.id} (state: ${inst.state})`);

// ── Auto-approve (optional) ───────────────────────────────────────────────────

if (autoApprove) {
  console.log("\n--auto flag set. Will auto-approve when the instance reaches approval gate.");
  console.log("Waiting 15s for analysis to complete...");
  await new Promise((r) => setTimeout(r, 15000));

  const approveRes = await fetch(`${ORCH8_URL}/instances/${inst.id}/signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signal_type: "human_input",
      payload: { approved: true },
    }),
  });

  if (approveRes.ok) {
    console.log("Auto-approval signal sent.");
  } else {
    console.log(`Auto-approval signal: ${approveRes.status} (instance may not be at approval gate yet)`);
    console.log("You can manually approve via:");
  }
}

// ── Output instructions ───────────────────────────────────────────────────────

console.log(`\n─── What's happening ───`);
console.log(`1. Fetching market data and prices`);
console.log(`2. LLM analyzing the market (GPT-4o)`);
console.log(`3. If BUY signal + high confidence → waiting for your approval`);
console.log(`4. After approval → placing order and monitoring`);

console.log(`\n─── Monitor ───`);
console.log(`  curl ${ORCH8_URL}/instances/${inst.id} | jq .state`);
console.log(`  curl ${ORCH8_URL}/instances/${inst.id}/outputs | jq .`);
console.log(`  curl ${ORCH8_URL}/instances/${inst.id}/tree | jq '.[] | {block_id, state}'`);

console.log(`\n─── Approve (when waiting) ───`);
console.log(`  curl -X POST ${ORCH8_URL}/instances/${inst.id}/signals \\`);
console.log(`    -H 'Content-Type: application/json' \\`);
console.log(`    -d '{"signal_type":"human_input","payload":{"approved":true}}'`);

console.log(`\n─── Cancel ───`);
console.log(`  curl -X PATCH ${ORCH8_URL}/instances/${inst.id}/state \\`);
console.log(`    -H 'Content-Type: application/json' \\`);
console.log(`    -d '{"state":"cancelled"}'`);
