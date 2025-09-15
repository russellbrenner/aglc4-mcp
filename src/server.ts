import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/transport/node.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchTool, loadIndex } from "./tools/search.js";

async function main() {
  await loadIndex();

  const server = new Server(
    {
      name: "aglc4-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [searchTool.schema],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === searchTool.schema.name) {
      return await searchTool.call(req.params.arguments);
    }
    throw new Error(`Unknown tool: ${req.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

