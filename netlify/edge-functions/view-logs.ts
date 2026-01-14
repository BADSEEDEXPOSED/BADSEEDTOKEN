import { getStore } from "@netlify/blobs";

export default async (req: Request) => {
    // Optional: Add simple auth or check if request comes from admin?
    // User requested "link appears just above the IP address ... to see the JSON"
    // Assuming public (or obscure execution), as no auth system exists yet.

    try {
        const store = getStore("visitor-logs");
        const blobKey = "visitors.json";

        // Read JSON directly
        const logs = await store.get(blobKey, { type: "json" });

        if (!logs) {
            return new Response(JSON.stringify([]), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify(logs, null, 2), {
            headers: {
                "Content-Type": "application/json",
                // Allow CORS so we can fetch it or open in new tab easily
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to retrieve logs" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
