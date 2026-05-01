/**
 * List active Polymarket markets for finding condition IDs.
 *
 * Usage:
 *   npx tsx scripts/markets.ts [--limit 10] [--min-volume 10000] [--search "keyword"]
 */

const args = process.argv.slice(2);
const limit = args.includes("--limit")
  ? args[args.indexOf("--limit") + 1]
  : "10";
const minVolume = args.includes("--min-volume")
  ? args[args.indexOf("--min-volume") + 1]
  : "1000";
const search = args.includes("--search")
  ? args[args.indexOf("--search") + 1]
  : undefined;

const params = new URLSearchParams({
  active: "true",
  closed: "false",
  limit,
  order: "volume",
  ascending: "false",
  volume_min: minVolume,
});

const url = `https://gamma-api.polymarket.com/events?${params}`;
console.log(`Fetching markets from Gamma API...\n`);

const res = await fetch(url);
if (!res.ok) {
  console.error(`Failed: ${res.status}`);
  process.exit(1);
}

interface GammaMarket {
  conditionId: string;
  question: string;
  outcomePrices: string;
  volume: string;
  endDate: string;
  clobTokenIds: string;
}

interface GammaEvent {
  title: string;
  markets: GammaMarket[];
}

const events = (await res.json()) as GammaEvent[];

let count = 0;
for (const event of events) {
  for (const market of event.markets) {
    const question = market.question || event.title;
    if (search && !question.toLowerCase().includes(search.toLowerCase())) continue;

    const prices = JSON.parse(market.outcomePrices || "[]") as string[];
    const yesPrice = prices[0] ? parseFloat(prices[0]).toFixed(2) : "?";
    const noPrice = prices[1] ? parseFloat(prices[1]).toFixed(2) : "?";
    const vol = parseFloat(market.volume || "0");

    console.log(`${question}`);
    console.log(`  Condition ID: ${market.conditionId}`);
    console.log(`  YES: ${yesPrice}  NO: ${noPrice}  Volume: $${vol.toLocaleString()}  End: ${market.endDate?.split("T")[0] ?? "?"}`);
    console.log();
    count++;
  }
}

if (count === 0) {
  console.log("No markets found. Try adjusting --min-volume or --search.");
} else {
  console.log(`─── Found ${count} markets ───`);
  console.log(`\nTo bet on a market:`);
  console.log(`  npx tsx scripts/bet.ts <condition-id> --size 5`);
}
