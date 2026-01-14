// functions/view-logs.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";

export const handler: Handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        // Get visitor logs from Redis (last 7 days)
        const key = 'analytics:visitor_logs';
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        const logs = await redis.zrange<string[]>(key, sevenDaysAgo, now, {
            byScore: true
        }).catch(() => []);

        const parsed = (logs || []).map((l: string) => {
            try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(parsed, null, 2)
        };

    } catch (error: any) {
        console.error("View logs error:", error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
        };
    }
};
