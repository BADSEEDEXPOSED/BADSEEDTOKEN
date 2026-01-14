// functions/view-logs.ts
import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export const handler: Handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const store = getStore("visitor-logs");
        const blobKey = "visitors.json";

        const logs = await store.get(blobKey, { type: "json" });

        if (!logs) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify([])
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(logs, null, 2)
        };

    } catch (error: any) {
        console.error("View logs error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Failed to retrieve logs" })
        };
    }
};
