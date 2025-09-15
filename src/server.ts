import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchTool, loadIndex, getIndexSummary } from "./tools/search.js";
import { loadConfig } from "./lib/config.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

async function main() {
  await loadIndex();
  const cfg = loadConfig();
  // Auto-index scan
  if (cfg.autoIndex) {
    try {
      await autoIndexAll(cfg.pdfDir, cfg.indexDir);
      if (cfg.watch) watchPdfDir(cfg.pdfDir, cfg.indexDir);
    } catch (e) {
      console.warn("Auto-index error:", e);
    }
  }
  try {
    const summary = await getIndexSummary();
    const created = summary.createdAt ? new Date(summary.createdAt).toISOString() : "unknown";
    const staleMark = summary.stale ? " (STALE)" : "";
    console.log(
      `[pdfsearch-mcp] index: source=${summary.source || "AGLC4"} chunks=${summary.chunks} created=${created}${staleMark}`
    );
    if (summary.stale && summary.pdfPath) {
      console.log(`[pdfsearch-mcp] Re-index recommended: npm run index -- --pdf ${summary.pdfPath}`);
    }
  } catch (e) {
    // non-fatal
  }

  const server = new Server(
    {
      name: "pdfsearch-mcp",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [searchTool.schema],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === searchTool.schema.name) {
      return await searchTool.call(req.params.arguments);
    }
    throw new Error(`Unknown tool: ${req.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function chooseIndexerCmd(): string[] {
  const compiled = path.resolve(process.cwd(), "dist/scripts/build-index.js");
  if (fs.existsSync(compiled)) return ["node", compiled];
  return ["tsx", path.resolve(process.cwd(), "scripts/build-index.ts")];
}

async function indexPdf(pdfPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = chooseIndexerCmd();
    const child = execFile(cmd[0], [...cmd.slice(1), "--pdf", pdfPath], { maxBuffer: 1024 * 1024 * 64 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

async function autoIndexAll(pdfDir: string, indexDir: string): Promise<void> {
  const files = await fs.promises.readdir(pdfDir);
  for (const f of files) {
    if (!/\.pdf$/i.test(f)) continue;
    const full = path.join(pdfDir, f);
    const base = f.replace(/\.pdf$/i, "");
    const idxPath = path.join(indexDir, base, "index.json");
    const needs = await indexOutdated(full, idxPath);
    if (needs) {
      console.log(`[pdfsearch-mcp] Indexing ${full}…`);
      await indexPdf(full);
    }
  }
}

async function indexOutdated(pdfPath: string, idxPath: string): Promise<boolean> {
  if (!fs.existsSync(idxPath)) return true;
  try {
    const raw = await fs.promises.readFile(idxPath, "utf8");
    const idx = JSON.parse(raw);
    if (!idx?.meta?.pdfHash) return true;
    const buf = await fs.promises.readFile(pdfPath);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    return hash !== idx.meta.pdfHash;
  } catch {
    return true;
  }
}

function watchPdfDir(pdfDir: string, indexDir: string): void {
  console.log(`[pdfsearch-mcp] Watching ${pdfDir} for new/changed PDFs…`);
  const queue = new Map<string, NodeJS.Timeout>();
  const schedule = (file: string) => {
    if (!/\.pdf$/i.test(file)) return;
    const full = path.join(pdfDir, file);
    if (queue.has(full)) clearTimeout(queue.get(full)!);
    queue.set(full, setTimeout(async () => {
      try {
        const base = file.replace(/\.pdf$/i, "");
        const idxPath = path.join(indexDir, base, "index.json");
        if (await indexOutdated(full, idxPath)) {
          console.log(`[pdfsearch-mcp] Detected change: indexing ${full}…`);
          await indexPdf(full);
        }
      } catch (e) {
        console.warn("Auto-index watch error:", e);
      }
    }, 500));
  };
  fs.watch(pdfDir, { persistent: false }, (_event, filename) => {
    if (typeof filename === "string") schedule(filename);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
