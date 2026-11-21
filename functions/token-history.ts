// functions/token-history.ts
// Historical milestones endpoint for Agent context
// Reads cached/calculated data - no extra blockchain calls

import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";

// Milestone data key (separate from live summary to avoid conflicts)
const MILESTONES_KEY = `token:MILESTONES_V1:${TOKEN_CONFIG.mint}`;

export const handler: Handler = async () => {
    try {
        // Get current summary for live data
        const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary)) || {};

        // Get stored milestones (calculated by amm-poller)
        const milestones = (await redis.hgetall<Record<string, string>>(MILESTONES_KEY)) || {};

        // Get all-time price/mcap data for ATH calculation
        // Use a wide range to capture all historical data
        const ALL_TIME_START = 0;
        const now = Date.now();

        const [priceRaw, mcapRaw, feesRaw] = await Promise.all([
            redis.zrange<string[]>(redisKeys.tsPrice, ALL_TIME_START, now, { byScore: true }).catch(() => []),
            redis.zrange<string[]>(redisKeys.tsMcap, ALL_TIME_START, now, { byScore: true }).catch(() => []),
            redis.zrange<string[]>(redisKeys.tsFeesCum, ALL_TIME_START, now, { byScore: true }).catch(() => [])
        ]);

        // Parse time series data
        const parse = (arr: unknown[]) => (arr || []).map((x) => {
            try { return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; }
        }).filter(Boolean);

        const prices = parse(priceRaw);
        const mcaps = parse(mcapRaw);
        const fees = parse(feesRaw);

        // Calculate ATH Market Cap
        let athMarketCapSol = 0;
        let athMarketCapDate = null;
        let athCurveProgress = 0;

        for (const point of mcaps) {
            const mcap = point.market_cap_sol || 0;
            if (mcap > athMarketCapSol) {
                athMarketCapSol = mcap;
                athMarketCapDate = new Date(point.t).toISOString();
            }
        }

        // Calculate ATH curve progress from stored milestones or estimate from price
        athCurveProgress = parseFloat(milestones.ath_curve_progress || "0");

        // If we don't have stored curve progress ATH, estimate from current if it's higher
        const currentCurveProgress = parseFloat(summary.curve_progress || "0");
        if (currentCurveProgress > athCurveProgress) {
            athCurveProgress = currentCurveProgress;
        }

        // Count today's observations. Price movement is not trading volume.
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayPrices = prices.filter(p => p.t >= todayStart);

        // Get total fees claimed
        const totalFeesClaimed = parseFloat(summary.total_fees_claimed_sol || "0");
        const totalDonated = parseFloat(summary.total_donated_sol || "0");

        // Current phase
        const currentPhase = summary.mode || "pre-launch";

        // Launch date (first price point timestamp)
        const launchDate = prices.length > 0
            ? new Date(prices[0].t).toISOString()
            : null;

        // Days since launch
        const daysSinceLaunch = launchDate
            ? Math.floor((now - new Date(launchDate).getTime()) / (24 * 60 * 60 * 1000))
            : 0;

        // Total data points (shows how much history we have)
        const totalDataPoints = prices.length;

        const response = {
            // Current state
            current_phase: currentPhase,
            days_since_launch: daysSinceLaunch,
            launch_date: launchDate,

            // All-time highs
            ath_market_cap_sol: athMarketCapSol,
            ath_market_cap_date: athMarketCapDate,
            ath_curve_progress_percent: athCurveProgress,

            // Cumulative stats
            total_fees_claimed_sol: totalFeesClaimed,
            total_donated_sol: totalDonated,

            today_volume_estimate_sol: null,
            today_data_points: todayPrices.length,

            // Data health
            total_historical_points: totalDataPoints,
            data_range_days: daysSinceLaunch,

            // Token info
            token: {
                mint: TOKEN_CONFIG.mint,
                symbol: TOKEN_CONFIG.symbol,
                name: TOKEN_CONFIG.name
            },

            // Timestamp
            calculated_at: new Date().toISOString()
        };

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
                // Cache for 5 minutes - this is historical data, doesn't need to be real-time
                "Cache-Control": "public, max-age=300"
            },
            body: JSON.stringify(response)
        };
    } catch (e) {
        console.error("Token history error:", e);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
                "Cache-Control": "no-store"
            },
            body: JSON.stringify({
                error: "Failed to retrieve historical data",
                current_phase: "unknown"
            })
        };
    }
};
