# pdfsearch-mcp

Minimal MCP server that indexes and searches PDFs (AGLC4 by default) for use by LLM tools (Claude Desktop, Claude Code, Codex, etc.). Search runs locally with no external APIs.

## Quickstart (Node)
- Place the PDF at `data/AGLC4.pdf`.
- Install: `npm install`
- Build index: `npm run index`
- Run server (stdio): `npm run dev` (TS) or `npm start` (compiled)

## Quickstart (Docker)
- Build: `docker build -t pdfsearch-mcp .`
- Run (mount data):
  - `mkdir -p data && cp path/to/AGLC4.pdf data/AGLC4.pdf`
  - `docker run -i --rm -v "$PWD/data:/app/data" pdfsearch-mcp`

The server communicates over stdio per MCP; configure your client/tool to launch the command and speak MCP.

## Making the PDF Machine-Readable (OCR)
- The indexer auto-detects image-only PDFs. If minimal text is found, it runs OCR via `ocrmypdf` and writes `data/AGLC4.ocr.pdf`, then indexes that.
- Local install:
  - macOS: `brew install ocrmypdf tesseract`
  - Debian/Ubuntu: `sudo apt-get install -y ocrmypdf tesseract-ocr`
- Environment:
  - `OCR_LANG` (default `eng`) — tesseract language(s), e.g. `eng+fra`.
  - `OCR_FORCE=1` — force OCR even if a text layer exists.
- Docker image already includes OCR tools.

## Commands
- `npm run index` — Extracts text from the PDF and creates a local search index under `data/index/`.
- `npm run dev` — Runs the MCP server in TypeScript via `tsx`.
- `npm run build` — Compiles TypeScript to `dist/`.
- `npm start` — Runs the compiled server.
- `npm run search -- "query"` — Quick local search without MCP.
- `npm run health` — Prints whether the PDF and index are present.
 - `npm run setup` — Install deps, index the default PDF, and start the server.
 - `npm run list-tools` — Minimal MCP client printing the server tool list.
 - `npm run call-tool -- '{"name":"searchpdf-mcp","arguments":{"query":"..."}}'` — Call a tool via MCP stdio and print JSON.

## MCP Integration
- Transport: stdio
- Command (compiled): `node dist/src/server.js`
- Command (dev): `npm run dev`
- Tools:
  - `searchpdf-mcp` — input `{ query: string, limit?: number, source?: string, before?: number, after?: number, budget?: number, phraseBoost?: number, phraseOnly?: boolean }`; returns text snippets with scores and added context from neighboring sections.

## Config
- `PDF_PATH` — Path to the PDF to index; defaults to `data/AGLC4.pdf`.
- `OCR_LANG` — OCR language(s) for `ocrmypdf` (default `eng`), e.g. `eng+fra`.
- `OCR_FORCE=1` — Force OCR even if a text layer exists.
- `MCP_CMD` — Override the server command used by `list-tools`/`call-tool` (e.g. `"node dist/src/server.js"`).
- `before`/`after`/`budget` — Optional context tuning parameters for previews.

### config.json
You can configure source and index directories and auto-index behavior via a `config.json` at the repo root:

```
{
  "pdfDir": "data",          // directory containing source PDFs
  "indexDir": "data/index",  // directory to store built indexes
  "autoIndex": true,          // scan + build missing/stale indexes on startup
  "watch": true               // watch pdfDir for changes and auto-index
}
```

Environment variables override these values: `PDF_DIR`, `INDEX_DIR`, `AUTO_INDEX`, `WATCH_INDEX`.

## Multiple PDFs
- Index per PDF: `npm run index -- --pdf path/to/SomeDoc.pdf` writes to `<indexDir>/SomeDoc/index.json` (and updates the legacy `<indexDir>/index.json`).
- Tool selection: pass `source` in `searchpdf-mcp` args (name, basename, or path). Examples:
  - `{ "source": "data/AGLC4.pdf", "query": "neutral citation" }`
  - `{ "source": "AGLC4", "query": "ibid" }`

### Auto-indexing
- On startup, the server scans `pdfDir` for `*.pdf` and builds indexes for any new or changed files (via content hash).
- If `watch` is true, the server watches `pdfDir` and automatically reindexes PDFs when they are added or updated.

### Claude Desktop Example
Add to your Claude Desktop config (merge keys accordingly):

```json
{
  "mcpServers": {
    "aglc4": {
      "command": "node",
  "args": ["dist/src/server.js"],
      "env": {}
    }
  }
}
```

For Docker:

```json
{
  "mcpServers": {
    "aglc4": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "${HOME}/aglc4-data:/app/data",
        "pdfsearch-mcp"
      ]
    }
  }
}
```

Ensure `${HOME}/aglc4-data/AGLC4.pdf` exists and that you’ve run indexing (or let the server/client invoke indexing step before use).

## Notes
- Indexing happens locally; only the canonical PDF is stored in `data/`.
- If you update the PDF, re-run `npm run index`.
- For client configuration, point tools to execute `npm start` (or the Docker image) as an MCP server.
- On startup, the server logs an index summary and warns if the index appears stale (PDF changed). Re-run indexing if prompted.

## Agent Usage
- See `docs/agent-usage.md` for comprehensive MCP integration details, example requests, and tuning options.

## Changelog
- 0.2.0
  - Rename project to `pdfsearch-mcp` and tool to `searchpdf-mcp`.
  - Richer search previews with surrounding context and page numbers.
  - Extract shared logic to `src/lib/pdf.ts`; add Vitest tests.
  - Reindexing flow now tags pages using `pdf-parse` pagerender.
- 0.1.0
  - Initial release.
