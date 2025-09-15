import fs from "node:fs";
import path from "node:path";

type Chunk = {
  id: number;
  text: string;
  page?: number;
};

type Index = {
  chunks: Chunk[];
  inverted: Record<string, number[]>; // token -> chunk ids
};

let INDEX: Index | null = null;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export async function loadIndex(): Promise<void> {
  const idxPath = path.resolve("data/index/index.json");
  if (!fs.existsSync(idxPath)) {
    console.warn(
      `Search index not found at ${idxPath}. Run \`npm run index\` to build it.`
    );
    INDEX = { chunks: [], inverted: {} };
    return;
  }
  const raw = await fs.promises.readFile(idxPath, "utf8");
  INDEX = JSON.parse(raw) as Index;
}

function scoreChunks(query: string, index: Index): { chunk: Chunk; score: number }[] {
  const qTokens = Array.from(new Set(tokenize(query)));
  const scores = new Map<number, number>();
  for (const t of qTokens) {
    const hits = index.inverted[t];
    if (!hits) continue;
    for (const id of hits) {
      scores.set(id, (scores.get(id) ?? 0) + 1);
    }
  }
  const results: { chunk: Chunk; score: number }[] = [];
  for (const [id, score] of scores) {
    const chunk = index.chunks[id];
    if (chunk) results.push({ chunk, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function searchLocal(query: string, limit = 5): Promise<{ chunk: Chunk; score: number }[]> {
  if (!INDEX) await loadIndex();
  const index = INDEX!;
  return scoreChunks(query, index).slice(0, Math.max(1, Math.min(20, limit)));
}

export const searchTool = {
  schema: {
    name: "search_aglc4",
    description: "Search the local AGLC4 PDF index and return relevant snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results", default: 5 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  async call(args: any) {
    if (!INDEX) await loadIndex();
    const index = INDEX!;
    const query = String(args?.query ?? "").trim();
    const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 5)));
    if (!query) {
      return { content: [{ type: "text", text: "Empty query" }] };
    }
    if (!index.chunks.length) {
      return { content: [{ type: "text", text: "Index is empty. Run `npm run index`." }] };
    }
    const ranked = scoreChunks(query, index).slice(0, limit);
    const items = ranked.map(({ chunk, score }) => {
      const preview = chunk.text.length > 400 ? chunk.text.slice(0, 400) + "…" : chunk.text;
      const loc = chunk.page != null ? ` (p.${chunk.page})` : "";
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
