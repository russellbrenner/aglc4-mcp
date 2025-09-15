import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Index, Chunk, tokenize, scoreChunks, expandContext, highlight } from "../lib/pdf.js";
import { loadConfig } from "../lib/config.js";

let INDEX: Index | null = null;

function sourceToIndexPath(source?: string): string {
  const cfg = loadConfig();
  if (!source) return path.resolve(cfg.indexDir, "index.json");
  const base = path.basename(source).replace(/\.pdf$/i, "");
  return path.resolve(cfg.indexDir, base, "index.json");
}

export async function loadIndex(source?: string): Promise<void> {
  const idxPath = sourceToIndexPath(source);
  if (!fs.existsSync(idxPath)) {
    console.warn(
      `Search index not found at ${idxPath}. Run \`npm run index\` to build it.`
    );
    INDEX = { chunks: [], inverted: {} };
    return;
  }
  const raw = await fs.promises.readFile(idxPath, "utf8");
  INDEX = JSON.parse(raw) as Index;
  // Stale index warning: compare stored PDF hash to current file if available
  try {
    const cfg = loadConfig();
    const base = (INDEX.meta?.source || source || "AGLC4").replace(/\.pdf$/i, "");
    const candidates = [
      path.resolve(cfg.pdfDir, `${base}.pdf`),
      path.resolve(cfg.pdfDir, base),
      source ? path.resolve(String(source)) : "",
    ].filter(Boolean) as string[];
    let pdfPath = "";
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) { pdfPath = c; break; }
    }
    if (pdfPath && INDEX.meta?.pdfHash) {
      const buf = await fs.promises.readFile(pdfPath);
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      if (hash !== INDEX.meta.pdfHash) {
        console.warn(`Index appears stale for ${pdfPath} (hash mismatch). Re-run: npm run index -- --pdf ${pdfPath}`);
      }
    }
  } catch {
    // best-effort only
  }
}

export async function getIndexSummary(source?: string): Promise<{
  source?: string;
  chunks: number;
  createdAt?: number;
  stale?: boolean;
  pdfPath?: string;
}> {
  await loadIndex(source);
  const meta = INDEX?.meta;
  let stale: boolean | undefined;
  let pdfPath: string | undefined;
  try {
    const cfg = loadConfig();
    const base = (meta?.source || source || "AGLC4").replace(/\.pdf$/i, "");
    const candidates = [
      path.resolve(cfg.pdfDir, `${base}.pdf`),
      path.resolve(cfg.pdfDir, base),
      source ? path.resolve(String(source)) : "",
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) { pdfPath = c; break; }
    }
    if (pdfPath && INDEX?.meta?.pdfHash) {
      const buf = await fs.promises.readFile(pdfPath);
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      stale = hash !== INDEX.meta.pdfHash;
    }
  } catch {
    // ignore
  }
  return { source: meta?.source, chunks: INDEX?.chunks.length ?? 0, createdAt: meta?.createdAt, stale, pdfPath };
}

export async function searchLocal(query: string, limit = 5): Promise<{ chunk: Chunk; score: number }[]> {
  if (!INDEX) await loadIndex();
  const index = INDEX!;
  return scoreChunks(query, index).slice(0, Math.max(1, Math.min(20, limit)));
}

export const searchTool = {
  schema: {
    name: "searchpdf-mcp",
    description: "Search the local AGLC4 PDF index and return relevant snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results", default: 5 },
        source: { type: "string", description: "PDF source name or path (optional)" },
        before: { type: "number", description: "Context chunks before match", default: 1 },
        after: { type: "number", description: "Context chunks after match", default: 2 },
        budget: { type: "number", description: "Max preview characters", default: 1200 },
        phraseBoost: { type: "number", description: "Extra score for exact phrase", default: 2 },
        phraseOnly: { type: "boolean", description: "Return only exact-phrase matches", default: false }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  async call(args: any) {
    const source = args?.source ? String(args.source) : undefined;
    await loadIndex(source);
    const index = INDEX!;
    const query = String(args?.query ?? "").trim();
    const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 5)));
    const before = Math.max(0, Number(args?.before ?? 1));
    const after = Math.max(0, Number(args?.after ?? 2));
    const budget = Math.max(200, Math.min(5000, Number(args?.budget ?? 1200)));
    if (!query) {
      return { content: [{ type: "text", text: "Empty query" }] };
    }
    if (!index.chunks.length) {
      return { content: [{ type: "text", text: "Index is empty. Run `npm run index`." }] };
    }
    const ranked = scoreChunks(query, index, { phraseBoost: Number(args?.phraseBoost ?? 2), phraseOnly: Boolean(args?.phraseOnly ?? false) }).slice(0, limit);
    const items = ranked.map(({ chunk, score }) => {
      const ctx = expandContext(index, chunk.id, { before, after, budget });
      const text = ctx.text.length > 800 ? ctx.text.slice(0, 800) + "…" : ctx.text;
      const preview = highlight(text, query);
      const loc = (ctx.page ?? chunk.page) != null ? ` (p.${ctx.page ?? chunk.page})` : "";
      return `•${loc} score=${score}: ${preview}`;
    });
    return {
      content: [
        {
          type: "text",
          text: items.join("\n") || "No matches"
        }
      ]
    };
  }
};
