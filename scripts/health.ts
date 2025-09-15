import fs from "node:fs";

async function main() {
  const pdf = fs.existsSync("data/AGLC4.pdf");
  const idx = fs.existsSync("data/index/index.json");
  console.log(JSON.stringify({ pdf, index: idx }, null, 2));
  if (!pdf) {
    console.error("Missing data/AGLC4.pdf");
  }
  if (!idx) {
    console.error("Missing data/index/index.json (run: npm run index)");
  }
}

main();

