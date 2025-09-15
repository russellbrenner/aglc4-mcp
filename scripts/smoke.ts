import { loadIndex, searchLocal } from "../src/tools/search.js";

async function main() {
  const queries = [
    "citation",
    "neutral citation",
    "footnote ibid",
    "case law citation format",
  ];
  await loadIndex();
  for (const q of queries) {
    const res = await searchLocal(q, 3);
    console.log(`\n=== ${q} ===`);
    if (!res.length) {
      console.log("No results");
      continue;
    }
    for (const { chunk, score } of res) {
      const preview = chunk.text.length > 300 ? chunk.text.slice(0, 300) + "…" : chunk.text;
      console.log(`score=${score}: ${preview.replace(/\s+/g, " ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

