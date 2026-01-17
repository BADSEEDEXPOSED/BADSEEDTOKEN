/*
    BADSEED MCP SERVER (GENERIC SKELETON)
    -------------------------------------
    This file is a placeholder for future MCP integration.

    NOTE: MCP SDK and zod are NOT supported in Netlify Edge Functions.
    When ready to implement MCP, move this to a regular Netlify function
    in the /functions directory instead.
*/

// ---------------------------------------------------------
// NETLIFY EDGE FUNCTION ENTRY POINT
// ---------------------------------------------------------

export default async (req: Request) => {
    // Basic Health Check
    if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
        return new Response("MCP Server Online (Skeleton)", { status: 200 });
    }

    return new Response("MCP Endpoint Ready. Configured as Generic Skeleton.", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
    });
};
