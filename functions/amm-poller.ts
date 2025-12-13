// functions/amm-poller.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";
import { getPumpAmmMetrics, getRaydiumMetrics } from "@lib/helius";

export const handler: Handler = async () => {
    let mode = (await redis.get<string>(redisKeys.mode)) || "pumpswap";

    let priceSol = 0;
    let marketCapSol = 0;
    let curveProgress = 0;

    if (mode === "pumpswap") {
        const m = await getPumpAmmMetrics();
        priceSol = m.priceSol;
        marketCapSol = m.marketCapSol;
        curveProgress = m.curveProgress;
        if (curveProgress >= 1) {
            await redis.set(redisKeys.mode, "raydium");
            mode = "raydium";
        }
    }

    if (mode === "raydium") {
        const m = await getRaydiumMetrics();
        priceSol = m.priceSol;
        marketCapSol = m.marketCapSol;
        curveProgress = 1;
    }

    const now = Date.now();
    const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary)) || {};

    const existingFees = parseFloat(summary.total_fees_claimed_sol || "0") || 0;
    const existingDonated = parseFloat(summary.total_donated_sol || "0") || 0;

    await redis.hmset(redisKeys.summary, {
        mint: TOKEN_CONFIG.mint,
        symbol: TOKEN_CONFIG.symbol,
        name: TOKEN_CONFIG.name,
        price_sol: priceSol.toString(),
        market_cap_sol: marketCapSol.toString(),
        curve_progress: curveProgress.toString(),
        total_fees_claimed_sol: existingFees.toString(),
        total_donated_sol: existingDonated.toString(),
        mode,
        last_updated: new Date(now).toISOString()
    });

    const pricePoint = JSON.stringify({ t: now, price_sol: priceSol });
    const mcapPoint = JSON.stringify({ t: now, market_cap_sol: marketCapSol });

    await redis.zadd(redisKeys.tsPrice, { score: now, member: pricePoint });
    await redis.zadd(redisKeys.tsMcap, { score: now, member: mcapPoint });

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, mode, priceSol, marketCapSol, curveProgress })
    };
};
