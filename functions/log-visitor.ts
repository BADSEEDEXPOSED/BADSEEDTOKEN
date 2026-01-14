// functions/log-visitor.ts
import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

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

        // Initialize Store
        const store = getStore("visitor-logs");
        const blobKey = "visitors.json";

        // Read existing logs (or empty array)
        let logs: any[] = [];
        try {
            const raw = await store.get(blobKey, { type: "json" });
            if (Array.isArray(raw)) logs = raw;
        } catch (e) {
            // No existing blob, start fresh
        }

        // Create Log Entry
        const entry = {
            timestamp: new Date().toISOString(),
            ip,
            location: { lat, lng },
            metadata: metadata || {}
        };

        logs.push(entry);

        // Save back to Blob
        await store.setJSON(blobKey, logs);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, count: logs.length })
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
