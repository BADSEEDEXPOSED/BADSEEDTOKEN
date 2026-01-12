import type { Config } from "@netlify/functions";

/**
 * GUARDIAN FUNCTION
 * Purpose: Cross-node redundancy for the BADSEED Prophecy Pipeline.
 * If the Exposed node's internal alarm fails to ring, this function 
 * reaches across the cloud to wake it up.
 */
export default async (req: Request) => {
    const { next_run } = await req.json() as { next_run: string };
    console.log(`[Guardian] Awake. Next scheduled run: ${next_run}`);

    const now = new Date();
    const currentHour = now.getUTCHours();

    // Choose which endpoint to poke based on the time of day
    // 00:00 UTC = Generation
    // 18:00 UTC = Reveal/Post
    let target = "";
    if (currentHour < 12) {
        target = "https://badseed.exposed/.netlify/functions/manual-trigger-prophecy?reveal=false";
        console.log("[Guardian] Poking Generation Endpoint...");
    } else {
        target = "https://badseed.exposed/.netlify/functions/prophecy-reveal";
        console.log("[Guardian] Poking Reveal/Post Endpoint...");
    }

    try {
        const response = await fetch(target);
        const status = response.status;
        const text = await response.text();

        console.log(`[Guardian] Poke Result (${status}):`, text.substring(0, 100));

        return new Response(JSON.stringify({
            success: true,
            status,
            target,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        console.error("[Guardian] Poke Failed:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const config: Config = {
    // Run at 00:10 and 18:10 UTC (slightly after the main triggers)
    schedule: "10 0,18 * * *"
};
