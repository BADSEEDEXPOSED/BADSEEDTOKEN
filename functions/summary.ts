// functions/summary.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";

export const handler: Handler = async () => {
    const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary)) || {};

    const response = {
        mint: TOKEN_CONFIG.mint,
        symbol: TOKEN_CONFIG.symbol,
        name: TOKEN_CONFIG.name,
        creator_wallet: TOKEN_CONFIG.creatorWallet,
        donation_wallet: TOKEN_CONFIG.donationWallet,
        price_sol: parseFloat(summary.price_sol || "0"),
        market_cap_sol: parseFloat(summary.market_cap_sol || "0"),
        curve_progress: parseFloat(summary.curve_progress || "0"),
        total_fees_claimed_sol: parseFloat(summary.total_fees_claimed_sol || "0"),
        total_donated_sol: parseFloat(summary.total_donated_sol || "0"),
        mode: summary.mode || "pumpswap",
        last_updated: summary.last_updated || null
    };

    return {
        statusCode: 200,
        body: JSON.stringify(response)
    };
};
