import fs from "node:fs";

export type Chunk = {
  id: number;
  text: string;
  page?: number;
};

export type Index = {
  chunks: Chunk[];
  inverted: Record<string, number[]>; // token -> chunk ids
  meta?: {
    source?: string;
    createdAt?: number;
    pdfSize?: number;
    pdfMtime?: number;
    pdfHash?: string;
  };
};

// Unicode-aware tokenizer that keeps letters, numbers, spaces, and hyphens
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Build inverted index with unique tokens per chunk
export function buildInverted(chunks: Chunk[]): Record<string, number[]> {
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

// Chunk strategy: parse text into paragraphs with page-number tracking, then
// coalesce adjacent paragraphs into ~1000-character chunks to keep rule text
// together (headings + body + examples) while capping size.
export function chunkText(
  text: string,
  opts: { maxLen?: number; sentenceSplit?: boolean } = {}
): Chunk[] {
  const maxLen = opts.maxLen ?? 1000;
  const sentenceSplit = opts.sentenceSplit ?? true;

  // Recognize explicit page markers like <<<PAGE:12>>> placed by build step
  const pageMarker = /^<<<PAGE:(\d+)>>>$/;
  const lines = text.split(/\r?\n/);
  let currentPage: number | undefined;

  type Para = { text: string; page?: number };
  const paras: Para[] = [];
  let buf: string[] = [];
  let bufPage: number | undefined;

  const flushPara = () => {
    const t = buf.join(" ").replace(/\s+/g, " ").trim();
    if (t) paras.push({ text: t, page: bufPage });
    buf = [];
    bufPage = undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const m = line.match(pageMarker);
    if (m) {
      // Page boundary: terminate any ongoing paragraph before switching pages
      if (buf.length) flushPara();
      currentPage = Number(m[1]);
      continue;
    }
    if (!line) {
      // paragraph break
      flushPara();
      continue;
    }
    if (buf.length === 0) bufPage = currentPage;
    buf.push(line);
  }
  flushPara();

  const chunks: Chunk[] = [];
  let id = 0;
  let acc = "";
  let accPage: number | undefined = undefined;

  const emit = (t: string) => {
    const text = t.trim();
    if (!text) return;
    chunks.push({ id: id++, text, page: accPage });
  };

  const flushAcc = () => {
    if (!acc.trim()) return;
    emit(acc);
    acc = "";
    accPage = undefined;
  };

  const pushPara = (p: Para) => {
    // If page changed relative to accumulated chunk, start a new chunk
    if (acc && p.page != null && accPage != null && p.page !== accPage) {
      flushAcc();
    }
    const paraText = p.text;
    const next = (acc ? acc + " " : "") + paraText;
    if (next.length <= maxLen) {
      if (!acc) accPage = p.page ?? accPage;
      acc = next;
      return;
    }
    if (!acc) {
      // single long paragraph: split by sentences if desired
      if (sentenceSplit) {
        const parts = paraText.split(/(?<=[\.!\?])\s+/g);
        let cur = "";
        for (const s of parts) {
          if ((cur + " " + s).trim().length > maxLen) {
            chunks.push({ id: id++, text: cur.trim(), page: p.page });
            cur = s;
          } else {
            cur += (cur ? " " : "") + s;
          }
        }
        if (cur.trim()) chunks.push({ id: id++, text: cur.trim(), page: p.page });
      } else {
        chunks.push({ id: id++, text: paraText, page: p.page });
      }
      return;
    }
    // acc exists but adding this para would exceed maxLen
    flushAcc();
    // start with this para (may split next iteration)
    accPage = p.page ?? accPage;
    acc = paraText;
  };

  for (const p of paras) pushPara(p);
  flushAcc();

  return chunks;
}

// Simple bag-of-words scoring by unique query token overlap
export function scoreChunks(
  query: string,
  index: Index,
  opts?: { phraseBoost?: number; phraseOnly?: boolean }
): { chunk: Chunk; score: number }[] {
  const qTokens = Array.from(new Set(tokenize(query)));
  const scores = new Map<number, number>();
  for (const t of qTokens) {
    const hits = index.inverted[t];
    if (!hits) continue;
    for (const id of hits) {
      scores.set(id, (scores.get(id) ?? 0) + 1);
    }
  }
  // Simple phrase boost if full query substring appears
  const q = query.trim().toLowerCase();
  const phraseBoost = Number(opts?.phraseBoost ?? 2);
  if (q.length >= 3 && phraseBoost > 0) {
    for (const c of index.chunks) {
      if (c.text.toLowerCase().includes(q)) {
        scores.set(c.id, (scores.get(c.id) ?? 0) + phraseBoost);
      }
    }
  }
  const results: { chunk: Chunk; score: number }[] = [];
  for (const [id, score] of scores) {
    const chunk = index.chunks[id];
    if (chunk) results.push({ chunk, score });
  }
  if (opts?.phraseOnly && q.length >= 3) {
    // Keep only chunks containing the exact phrase
    const lowered = new Set(
      index.chunks.filter((c) => c.text.toLowerCase().includes(q)).map((c) => c.id)
    );
    for (let i = results.length - 1; i >= 0; i--) {
      if (!lowered.has(results[i].chunk.id)) results.splice(i, 1);
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// Expand a matched chunk with neighboring context for richer previews
export function expandContext(
  index: Index,
  centerId: number,
  opts: { before?: number; after?: number; budget?: number } = {}
): { text: string; page?: number } {
  const before = opts.before ?? 1;
  const after = opts.after ?? 2;
  const budget = opts.budget ?? 1200; // max characters
  const start = Math.max(0, centerId - before);
  const end = Math.min(index.chunks.length - 1, centerId + after);
  const parts: string[] = [];
  let page: number | undefined = index.chunks[centerId]?.page;
  for (let i = start; i <= end; i++) {
    const t = index.chunks[i]?.text || "";
    if (!t) continue;
    if (parts.join(" ").length + t.length + 1 > budget) break;
    parts.push(t);
    if (page == null && index.chunks[i]?.page != null) page = index.chunks[i].page;
  }
  return { text: parts.join("\n\n"), page };
}

export function highlight(text: string, query: string): string {
  const tokens = Array.from(new Set(tokenize(query)));
  if (!tokens.length) return text;
  // Escape regex special chars in tokens
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b(${tokens.map(esc).join("|")})\\b`, "gi");
  return text.replace(pattern, (m) => `[${m}]`);
}

// Utility to write JSON with stable formatting for tests if needed
export async function writeJson(file: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data);
  await fs.promises.writeFile(file, content);
}
