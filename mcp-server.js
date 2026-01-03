// Silencing dotenv output for MCP protocol compliance
const stdoutWrite = process.stdout.write;
process.stdout.write = () => { };
require('dotenv').config();
process.stdout.write = stdoutWrite;

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// Initialize Server
const server = new McpServer({
    name: "badseed-token",
    version: "1.0.0"
});

// ------------------------------------------------------------------
// CAPABILITIES (Placeholder for Token Node)
// ------------------------------------------------------------------

// Tool: Get Token Summary
server.tool(
    "get_token_summary",
    "Returns the current market summary (Price, Supply, Market Cap) from Redis.",
    {},
    async () => {
        // STARTUP: We need to connect to Upstash just like the Netlify function does.
        // For now, returning a static placeholder to verify connection.
        return {
            content: [{
                type: "text", text: JSON.stringify({
                    status: "connected",
                    node: "badseed-token",
                    message: "Real logic pending implementation."
                })
            }]
        };
    }
);

// ------------------------------------------------------------------
// STARTUP
// ------------------------------------------------------------------
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
