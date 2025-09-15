import { spawn } from "node:child_process";

function chooseCmd(): string[] {
  if (process.env.MCP_CMD) return process.env.MCP_CMD.split(/\s+/);
  try { require('node:fs').accessSync('dist/src/server.js'); return ["node", "dist/src/server.js"]; } catch {}
  return ["tsx", "src/server.ts"]; // dev fallback
}

async function main() {
  const arg = process.argv.slice(2).join(" ");
  if (!arg) {
    console.error("Usage: npm run call-tool -- '{\"name\":\"searchpdf-mcp\",\"arguments\":{" + "\"query\":\"neutral citation\"}}'");
    process.exit(2);
  }
  let call;
  try { call = JSON.parse(arg); } catch { console.error("Argument must be JSON"); process.exit(2); }
  const cmd = chooseCmd();
  const child = spawn(cmd[0], cmd.slice(1), { stdio: ["pipe", "pipe", "inherit"] });
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    for (const line of buf.split(/\n/)) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 3) {
          console.log(JSON.stringify(msg, null, 2));
          child.kill();
        }
      } catch {}
    }
  });
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "0.6", clientInfo: { name: "local-cli", version: "0.0.0" } } };
  const list = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
  const req = { jsonrpc: "2.0", id: 3, method: "tools/call", params: call };
  child.stdin.write(JSON.stringify(init) + "\n");
  setTimeout(() => child.stdin.write(JSON.stringify(list) + "\n"), 50);
  setTimeout(() => child.stdin.write(JSON.stringify(req) + "\n"), 100);
}

main().catch((e) => { console.error(e); process.exit(1); });

