import fs from "node:fs";
import path from "node:path";
import pdfParse from "pdf-parse";

type Chunk = { id: number; text: string; page?: number };
type Index = { chunks: Chunk[]; inverted: Record<string, number[]> };

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

async function ensureDirs() {
  await fs.promises.mkdir("data/index", { recursive: true });
}

async function readPdf(pdfPath: string): Promise<string> {
  const buf = await fs.promises.readFile(pdfPath);
  const res = await pdfParse(buf);
  return res.text || "";
}

function chunkText(text: string): Chunk[] {
  const para = text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const chunks: Chunk[] = [];
  let id = 0;
  for (const p of para) {
    if (p.length <= 800) {
      chunks.push({ id: id++, text: p });
    } else {
      // further split long paragraphs
      const parts = p.split(/(?<=[\.\?\!])\s+/g);
      let current = "";
      for (const sentence of parts) {
        if ((current + " " + sentence).trim().length > 800) {
          chunks.push({ id: id++, text: current.trim() });
          current = sentence;
        } else {
          current += (current ? " " : "") + sentence;
        }
      }
      if (current.trim()) chunks.push({ id: id++, text: current.trim() });
    }
  }
  return chunks;
}

function buildInverted(chunks: Chunk[]): Record<string, number[]> {
  const inverted: Record<string, number[]> = {};
  for (const c of chunks) {
    const seen = new Set<string>();
    for (const t of tokenize(c.text)) {
      if (seen.has(t)) continue;
      seen.add(t);
      (inverted[t] ||= []).push(c.id);
    }
  }
  return inverted;
}

async function main() {
  const pdfPath = process.env.PDF_PATH || path.resolve("data/AGLC4.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error(`Missing PDF at ${pdfPath}. Place the file and re-run.`);
    process.exit(1);
  }
  await ensureDirs();
  console.log("Reading PDF…");
  const text = await readPdf(pdfPath);
  console.log("Chunking…");
  const chunks = chunkText(text);
  console.log(`Chunks: ${chunks.length}`);
  const inverted = buildInverted(chunks);
  const index: Index = { chunks, inverted };
  const outPath = path.resolve("data/index/index.json");
  await fs.promises.writeFile(outPath, JSON.stringify(index));
  console.log(`Wrote index to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

