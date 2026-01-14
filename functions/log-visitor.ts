// functions/log-visitor.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";

// Blacklist Constants (Mirroring Frontend)
const BLACKLIST_IPS = ['184.65.126.30'];
const BLACKLIST_LOC = { lat: 49.0424, lng: -122.2840, tolerance: 0.05 };

function isBlacklisted(ip: string, lat: number, lng: number): boolean {
    if (BLACKLIST_IPS.includes(ip)) return true;
    if (Math.abs(lat - BLACKLIST_LOC.lat) < BLACKLIST_LOC.tolerance &&
        Math.abs(lng - BLACKLIST_LOC.lng) < BLACKLIST_LOC.tolerance) {
        return true;
    }
    return false;
}

export const handler: Handler = async (event, context) => {
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
        const { ip, lat, lng, metadata } = body;

        // Security: Failsafe Blacklist Check
        if (isBlacklisted(ip, lat, lng)) {
            console.log(`Blocked logging for blacklisted target: ${ip}`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, status: "filtered" })
            };
        }

        // Create Log Entry
        const entry = {
            timestamp: new Date().toISOString(),
            ip,
            location: { lat, lng },
            metadata: metadata || {}
        };

        // Store in Redis with timestamp as score
        const key = 'analytics:visitor_logs';
        await redis.zadd(key, { score: Date.now(), member: JSON.stringify(entry) });

        // Keep only last 7 days of data
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
