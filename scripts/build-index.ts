import fs from "node:fs";
import path from "node:path";
// Workaround: import implementation directly to avoid debug harness in pdf-parse/index.js
// that tries to read a test PDF when module.parent is undefined under ESM/tsx.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildInverted, chunkText, Index, writeJson } from "../src/lib/pdf.js";
import { loadConfig } from "../src/lib/config.js";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

async function ensureDirs() {
  await fs.promises.mkdir("data/index", { recursive: true });
}

// Render pages and insert explicit page markers understood by the chunker
async function readPdf(pdfPath: string): Promise<string> {
  const buf = await fs.promises.readFile(pdfPath);
  const res = await pdfParse(buf, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((tc: any) => {
        const strs = tc.items.map((it: any) => it.str);
        const pageText = strs.join("\n");
        return `<<<PAGE:${pageData.pageNumber}>>>\n` + pageText;
      });
    },
  });
  return res.text || "";
}

async function ocrPdf(input: string, output: string): Promise<void> {
  const lang = process.env.OCR_LANG || "eng";
  const force = process.env.OCR_FORCE === "1";
  const args = [force ? "--force-ocr" : "--skip-text", "--language", lang, input, output];
  try {
    await execFileAsync("ocrmypdf", args, { maxBuffer: 1024 * 1024 * 64 });
  } catch (err: any) {
    const hint =
      process.platform === "darwin"
        ? "Install with: brew install ocrmypdf tesseract"
        : "Install with: apt-get install -y ocrmypdf tesseract-ocr (Debian/Ubuntu)";
    throw new Error(
      `Failed to run ocrmypdf. Ensure it is installed. ${hint}.\nOriginal error: ${err?.message || err}`
    );
  }
}

async function main() {
  // Accept CLI arg: --pdf <path>
  const cfg = loadConfig();
  const argIdx = process.argv.indexOf("--pdf");
  let pdfPath = (argIdx !== -1 ? process.argv[argIdx + 1] : undefined) || process.env.PDF_PATH || path.resolve(cfg.pdfDir, "AGLC4.pdf");
  if (!path.isAbsolute(pdfPath)) pdfPath = path.resolve(cfg.pdfDir, pdfPath);
  if (!fs.existsSync(pdfPath)) {
    console.error(`Missing PDF at ${pdfPath}. Place the file and re-run.`);
    process.exit(1);
  }
  await ensureDirs();
  console.log("Reading PDF…");
  let text = await readPdf(pdfPath);
  if (!text || text.trim().length < 1000) {
    const ocrOut = path.resolve("data/AGLC4.ocr.pdf");
    console.log("PDF appears non-text or very short; running OCR…");
    await ocrPdf(pdfPath, ocrOut);
    console.log("OCR complete. Re-reading OCR'd PDF…");
    text = await readPdf(ocrOut);
  }
  console.log("Chunking…");
  const chunks = chunkText(text, { maxLen: 1000, sentenceSplit: true });
  console.log(`Chunks: ${chunks.length}`);
  const inverted = buildInverted(chunks);
  // Build metadata
  const stat = await fs.promises.stat(pdfPath);
  const hash = crypto.createHash("sha256").update(await fs.promises.readFile(pdfPath)).digest("hex");
  const base = path.basename(pdfPath).replace(/\.pdf$/i, "");
  const index: Index = { chunks, inverted, meta: { source: base, createdAt: Date.now(), pdfSize: stat.size, pdfMtime: stat.mtimeMs, pdfHash: hash } };
  // Write per-source path and legacy path
  const outDir = path.resolve(cfg.indexDir, base);
  await fs.promises.mkdir(outDir, { recursive: true });
  const perSource = path.join(outDir, "index.json");
  const legacy = path.resolve(cfg.indexDir, "index.json");
  await writeJson(perSource, index);
  await writeJson(legacy, index);
  console.log(`Wrote index to ${perSource} and ${legacy}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
