import { searchLocal, loadIndex } from "../src/tools/search.js";

async function main() {
  const q = process.argv.slice(2).join(" ").trim();
  if (!q) {
    console.error("Usage: tsx scripts/quick-search.ts <query>");
    process.exit(2);
  }
  await loadIndex();
  const results = await searchLocal(q, 5);
  for (const { chunk, score } of results) {
    const preview = chunk.text.length > 400 ? chunk.text.slice(0, 400) + "…" : chunk.text;
    const loc = chunk.page != null ? ` (p.${chunk.page})` : "";
    console.log(`•${loc} score=${score}: ${preview}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

