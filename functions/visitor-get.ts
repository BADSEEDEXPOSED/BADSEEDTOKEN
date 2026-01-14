// functions/visitor-get.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";

export const handler: Handler = async (event) => {
    try {
        const key = 'analytics:visitor_sessions';
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // Get recent visitors (last 24h)
        const recentVisitors = await redis.zrange<string[]>(key, oneDayAgo, now, {
            byScore: true
        }).catch(() => []);

        const visitors = recentVisitors.map(v => JSON.parse(v));

        // Calculate stats
        const uniqueIPs = new Set(visitors.map(v => v.ip)).size;
        const countries = [...new Set(visitors.map(v => v.country))];
        const cities = [...new Set(visitors.map(v => v.city))];

        return {
            statusCode: 200,
            body: JSON.stringify({
                totalVisits: visitors.length,
                uniqueIPs,
                countries,
                cities,
                recentVisitors: visitors.slice(-50)
            })
        };
    } catch (e: any) {
        console.error("Visitor get error:", e);
        return {
            statusCode: 200,
            body: JSON.stringify({
                totalVisits: 0,
                uniqueIPs: 0,
                countries: [],
                cities: [],
                recentVisitors: []
            })
        };
    }
};
