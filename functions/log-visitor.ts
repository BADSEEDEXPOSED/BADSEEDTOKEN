// functions/log-visitor.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const headerIp = event.headers?.['cf-connecting-ip'] || event.headers?.['x-forwarded-for']?.split(',')[0]?.trim();
        const ip = body.ip || headerIp || 'unknown';
        const { lat, lng, metadata } = body;

        const entry = {
            timestamp: new Date().toISOString(),
            ip,
            location: { lat, lng },
            metadata: metadata || {}
        };

        const key = 'analytics:visitor_logs';
        await redis.zadd(key, { score: Date.now(), member: JSON.stringify(entry) });

        // Keep last 7 days of visitor location logs
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        await redis.zremrangebyscore(key, 0, sevenDaysAgo);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error: any) {
        console.error("Logging error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
