// functions/summary.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";

export const handler: Handler = async () => {
    try {
        const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary).catch(() => null)) || {};

        const INIT_PRICE = 0.000000028; // 30 SOL / 1B Tokens
        const INIT_MCAP = 28; // 28-30 SOL approx

        // Determining Mode First
        const mode = summary.mode || "pre-launch"; // Default to pre-launch if cold

        // Smart Defaults: If Redis is cold or 0, use Init values for Pre-Launch
        const price_sol = parseFloat(summary.price_sol || "0") || (mode === "pre-launch" ? INIT_PRICE : 0);
        const market_cap_sol = parseFloat(summary.market_cap_sol || "0") || (mode === "pre-launch" ? INIT_MCAP : 0);

        const response = {
            mint: TOKEN_CONFIG.mint,
            symbol: TOKEN_CONFIG.symbol,
            name: TOKEN_CONFIG.name,
            creator_wallet: TOKEN_CONFIG.creatorWallet,
            donation_wallet: TOKEN_CONFIG.donationWallet,
            price_sol: price_sol,
            market_cap_sol: market_cap_sol,
            curve_progress: parseFloat(summary.curve_progress || "0"),
            total_fees_claimed_sol: parseFloat(summary.total_fees_claimed_sol || "0"),
            total_donated_sol: parseFloat(summary.total_donated_sol || "0"),
            mode: mode,
            last_updated: summary.last_updated || null,
            debug_price: summary.debug_price || `vSol (30.00) / vTokens (1073.0M)`,
            debug_mcap: summary.debug_mcap || `Price * Supply (28.0 SOL)`,
            debug_progress: summary.debug_progress || `Sold (0.0M) / Target (800M)`
        };

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };
    } catch (e) {
        console.error("Summary error:", e);
        // Fallback response: Pre-Launch State
        return {
            statusCode: 200,
            body: JSON.stringify({
                mint: TOKEN_CONFIG.mint,
                symbol: TOKEN_CONFIG.symbol,
                name: TOKEN_CONFIG.name,
                creator_wallet: TOKEN_CONFIG.creatorWallet,
                donation_wallet: TOKEN_CONFIG.donationWallet,
                price_sol: 0.000000028,
                market_cap_sol: 28,
                curve_progress: 0,
                total_fees_claimed_sol: 0,
                total_donated_sol: 0,
                mode: "pre-launch",
                last_updated: null,
                debug_price: "vSol (30.00) / vTokens (1073.0M)",
                debug_mcap: "Price * Supply (28.0 SOL)",
                debug_progress: "Sold (0.0M) / Target (800M)"
                debug_progress: "Sold (0.0M) / Target (800M)"
            })
        };
    }
};
