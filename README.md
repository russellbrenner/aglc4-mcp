# aglc4-mcp

Minimal MCP server that indexes and searches the AGLC4 guide PDF for use by LLM tools (Claude Desktop, Claude Code, Codex, etc.). Search runs locally with no external APIs.

## Quickstart (Node)
- Place the PDF at `data/AGLC4.pdf`.
- Install: `npm install`
- Build index: `npm run index`
- Run server (stdio): `npm run dev` (TS) or `npm start` (compiled)

## Quickstart (Docker)
- Build: `docker build -t aglc4-mcp .`
- Run (mount data):
  - `mkdir -p data && cp path/to/AGLC4.pdf data/AGLC4.pdf`
  - `docker run -i --rm -v "$PWD/data:/app/data" aglc4-mcp`

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

## MCP Integration
- Transport: stdio
- Command (compiled): `node dist/server.js`
- Command (dev): `npm run dev`
- Tools:
  - `search_aglc4` — input `{ query: string, limit?: number }`; returns text snippets with scores.

### Claude Desktop Example
Add to your Claude Desktop config (merge keys accordingly):

```json
{
  "mcpServers": {
    "aglc4": {
      "command": "node",
      "args": ["dist/server.js"],
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
        "aglc4-mcp"
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
