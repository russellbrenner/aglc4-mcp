# Repository Guidelines

This repo hosts a minimal MCP server that indexes and searches the AGLC4 guide PDF for use by LLM tools (Claude Desktop, Claude Code, Codex, etc.). Keep scope small, predictable, and offline‑friendly.

## Project Structure & Module Organization
- `data/AGLC4.pdf` — source document (canonical; do not modify).
- `data/index/` — built search index (JSON files; generated).
- `src/` — MCP server (TypeScript).
  - `src/server.ts` — server entry.
  - `src/tools/search.ts` — MCP search tool implementation.
  - `src/lib/pdf.ts` — PDF text extraction + chunking.
- `scripts/build-index.ts` — builds the index from the PDF.
- `test/` — unit/integration tests.

Note: If a Python variant is used, mirror this layout under `mcp_server/` and name tools identically.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — run the TS server in watch mode.
- `npm run build` — compile to `dist/` via `tsc`.
- `npm start` — run compiled server.
- `npm test` — run tests.
- `npm run index` — build/update `data/index/` from `data/AGLC4.pdf`.

Example: `npm run index && npm run dev`

## Coding Style & Naming Conventions
- Language: TypeScript (Node 18+). Indent 2 spaces.
- Lint/format: ESLint + Prettier. Run `npm run lint` / `npm run format`.
- Filenames: `kebab-case.ts`; classes `PascalCase`; vars/functions `camelCase`.
- Keep modules small; pure functions for parsing/indexing where practical.

## Testing Guidelines
- Framework: Vitest or Jest. Tests in `test/`, named `*.spec.ts`.
- Cover extraction, chunking, indexing, and ranking. Target ≥80% line coverage.
- Add fixture slices of the PDF (not the full file) for deterministic tests.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- PRs include: summary, rationale, test plan (commands), linked issues, and sample queries + expected hits.
- Keep diffs focused; update docs and scripts when adding commands.

## Security & Configuration Tips
- No external APIs by default; keep all search local to the repo.
- Do not commit secrets. Use `.env` if needed (gitignored) and document required vars.
- Large binaries: only the canonical PDF belongs in `data/`.

## Agent-Specific Instructions
- Respect this AGENTS.md for all changes. Prefer small, surgical patches.
- If the PDF changes, re-run `npm run index` and include regenerated artifacts.
- When searching the tree, prefer `rg` (ripgrep). Keep new dependencies minimal.
