// functions/visitor-track.ts
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

    try {
        // Get IP address from Netlify headers
        const ip = event.headers['x-nf-client-connection-ip'] ||
                   event.headers['x-forwarded-for']?.split(',')[0] ||
                   'unknown';

        // Get geolocation from Netlify Edge
        const country = event.headers['x-country'] || 'unknown';
        const city = event.headers['x-city'] || 'unknown';
        const timezone = event.headers['x-timezone'] || 'unknown';

        const visitorEvent = {
            ip,
            country,
            city,
            timezone,
            timestamp: Date.now(),
            node: 'value',
            userAgent: event.headers['user-agent'] || 'unknown'
        };

        // Store in Redis with timestamp as score
        const key = 'analytics:visitor_sessions';
        await redis.zadd(key, { score: visitorEvent.timestamp, member: JSON.stringify(visitorEvent) });

        // Keep only last 7 days of data
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        await redis.zremrangebyscore(key, 0, sevenDaysAgo);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, tracked: visitorEvent })
        };
    } catch (e: any) {
        console.error('Visitor tracking error:', e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: e.message })
        };
    }
};
