Agent Usage Guide

This document provides practical guidance for integrating and using the pdfsearch-mcp server with MCP-compatible agents (Claude Desktop, Claude Code, Codex CLI, etc.).

Capabilities
- Tool: `searchpdf-mcp`
  - Input: `{ query: string, limit?: number, source?: string, before?: number, after?: number, budget?: number, phraseBoost?: number, phraseOnly?: boolean }`
  - Output: `content[0].text` is a human-readable list with page numbers and bracket-highlighted matches.
  - Behavior: Local-only search over one or more PDFs indexed into `<indexDir>/<basename>/index.json`.

Recommended Setup
- Ensure your source PDFs are placed in `pdfDir` (default `data/`).
- Build or rebuild indexes:
  - `npm run index` (uses default PDF `AGLC4.pdf`)
  - `npm run index -- --pdf path/to/SomeDoc.pdf` (writes to `<indexDir>/SomeDoc/index.json`)
- Start the server:
  - Dev: `npm run dev`
  - Compiled: `npm start`

MCP Client Configuration Examples
Claude Desktop
{
  "mcpServers": {
    "pdfsearch": {
      "command": "node",
      "args": ["dist/src/server.js"],
      "env": {}
    }
  }
}

Docker variant
{
  "mcpServers": {
    "pdfsearch": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "${HOME}/aglc4-data:/app/data",
        "pdfsearch-mcp"
      ]
    }
  }
}

Codex CLI / Local Debugging
- List tools: `npm run list-tools`
- Call tool:
- `npm run call-tool -- '{"name":"searchpdf-mcp","arguments":{"query":"neutral citation","limit":3}}'`

Tool Input Tips
- query
  - Keep concise; include key terms or exact phrases for best results.
- limit
  - 3–5 is a good default; up to 20 supported.
- source
  - Use when multiple PDFs are indexed; accepts a basename (e.g. `AGLC4`) or path.
- before / after
  - Control context expansion around the matched chunk; use small values to keep previews tight (default 1/2).
- budget
  - Max preview length in characters (default 1200). Increase if you want more surrounding content.
- phraseBoost
  - Numerical score added when the exact query substring appears in a chunk (default 2). Increase to prioritize exact-phrase hits.
- phraseOnly
  - If true, returns only chunks containing the exact phrase; useful when precision matters.

Operational Notes
- Index freshness
  - Server prints a banner with index status on startup and warns if the index is stale (PDF changed). Re-run indexing if prompted.
- Auto-index
  - On startup, the server scans `pdfDir` and indexes any new or changed PDFs. If `watch` is enabled, it reindexes on file changes.
- Config
  - Configure via `config.json` or env vars. See README “Config” for details.
- OCR
  - If the PDF has little/no text, the indexer attempts OCR (`ocrmypdf`). Install OCR tools locally or use the Docker image.

JSON-RPC Examples (stdio)
- Initialize
  {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"0.6","clientInfo":{"name":"agent","version":"1.0.0"}}}
- List tools
  {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
- Call tool (basic)
  {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"searchpdf-mcp","arguments":{"query":"neutral citation"}}}
- Call tool (with options)
  {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"searchpdf-mcp","arguments":{"query":"law report series","limit":5,"before":0,"after":3,"budget":2000,"phraseBoost":4}}}

Best Practices
- Prefer exact phrases for citation rules (e.g., "medium neutral citation").
- Use `source` to disambiguate when multiple documents are present.
- Keep `before/after` small for focused previews; increase if agents need more context.
- On PDF updates, rely on auto-index or manually run `npm run index`.

