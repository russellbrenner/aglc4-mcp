% aglc4-mcp

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

## Commands
- `npm run index` — Extracts text from the PDF and creates a local search index under `data/index/`.
- `npm run dev` — Runs the MCP server in TypeScript via `tsx`.
- `npm run build` — Compiles TypeScript to `dist/`.
- `npm start` — Runs the compiled server.

## Notes
- Indexing happens locally; only the canonical PDF is stored in `data/`.
- If you update the PDF, re-run `npm run index`.
- For client configuration, point tools to execute `npm start` (or the Docker image) as an MCP server.

