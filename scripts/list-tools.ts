import { spawn } from "node:child_process";

function chooseCmd(): string[] {
  if (process.env.MCP_CMD) return process.env.MCP_CMD.split(/\s+/);
  try { require('node:fs').accessSync('dist/src/server.js'); return ["node", "dist/src/server.js"]; } catch {}
  return ["tsx", "src/server.ts"]; // dev fallback
}

async function main() {
  const cmd = chooseCmd();
  const child = spawn(cmd[0], cmd.slice(1), { stdio: ["pipe", "pipe", "inherit"] });
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    for (const line of buf.split(/\n/)) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 2) {
          console.log(JSON.stringify(msg, null, 2));
          child.kill();
        }
      } catch {}
    }
  });
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "0.6", clientInfo: { name: "local-cli", version: "0.0.0" } } };
  const list = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
  child.stdin.write(JSON.stringify(init) + "\n");
  setTimeout(() => child.stdin.write(JSON.stringify(list) + "\n"), 50);
}

main().catch((e) => { console.error(e); process.exit(1); });

