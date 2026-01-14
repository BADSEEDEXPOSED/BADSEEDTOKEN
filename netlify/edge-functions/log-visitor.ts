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

export default async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await req.json();
        const { ip, lat, lng, metadata } = body;

        // Security: Failsafe Blacklist Check
        if (isBlacklisted(ip, lat, lng)) {
            console.log(`Blocked logging for blacklisted target: ${ip}`);
            // Return success to confuse the adversary? Or just 200 to imply nothing wrong.
            // Let's return 200 "Logged" but actually do nothing.
            return new Response(JSON.stringify({ success: true, status: "filtered" }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // Initialize Store
        const store = getStore("visitor-logs");
        const blobKey = "visitors.json";

        // Read existing logs (or empty array)
        // Note: For high traffic, this simple read-modify-write is not atomic and race conditions exist.
        // But for this scale, it's acceptable.
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

        // Prepend (newest first) or Append? User asked for "saved", usually log files append.
        // Let's push to end.
        logs.push(entry);

        // Save back to Blob
        await store.setJSON(blobKey, logs);

        return new Response(JSON.stringify({ success: true, count: logs.length }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Logging error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
