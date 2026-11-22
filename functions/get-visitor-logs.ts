// functions/get-visitor-logs.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";

function getExcludedIps(): Set<string> {
    const raw = (typeof process !== "undefined" && process.env?.EXCLUDED_LOG_IPS) || "";
    return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export const handler: Handler = async () => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const key = 'analytics:visitor_logs';
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        const logs = await redis.zrange<string[]>(key, sevenDaysAgo, now, {
            byScore: true
        }).catch(() => []);

        const excluded = getExcludedIps();
        const parsed = (logs || [])
            .map((l: string) => {
                try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
            })
            .filter((entry: any) => entry && !excluded.has(String(entry.ip || '').trim()));

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
