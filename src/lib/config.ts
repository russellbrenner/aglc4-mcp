import fs from "node:fs";
import path from "node:path";

export type AppConfig = {
  pdfDir: string; // directory containing source PDFs
  indexDir: string; // directory root for built indexes
  autoIndex: boolean; // scan and build missing/stale indexes on startup
  watch: boolean; // watch pdfDir for changes and auto-index
};

const defaults: AppConfig = {
  pdfDir: "data",
  indexDir: "data/index",
  autoIndex: true,
  watch: true,
};

export function loadConfig(cwd: string = process.cwd()): AppConfig {
  let cfg: Partial<AppConfig> = {};
  const file = path.resolve(cwd, "config.json");
  if (fs.existsSync(file)) {
    try {
      cfg = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.warn(`Failed to parse config.json: ${e}`);
    }
  }
  const merged: AppConfig = { ...defaults, ...(cfg as AppConfig) } as AppConfig;
  if (process.env.PDF_DIR) merged.pdfDir = process.env.PDF_DIR;
  if (process.env.INDEX_DIR) merged.indexDir = process.env.INDEX_DIR;
  if (process.env.AUTO_INDEX != null) merged.autoIndex = process.env.AUTO_INDEX !== "0";
  if (process.env.WATCH_INDEX != null) merged.watch = process.env.WATCH_INDEX !== "0";
  // Normalize to absolute paths
  merged.pdfDir = path.resolve(cwd, merged.pdfDir);
  merged.indexDir = path.resolve(cwd, merged.indexDir);
  return merged;
}
