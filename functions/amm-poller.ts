// functions/amm-poller.ts
import type { Handler } from "@netlify/functions";
import { redis } from "../lib/redis";
import { redisKeys, TOKEN_CONFIG } from "../lib/tokenConfig";
import { getRaydiumMetrics, connection } from "../lib/helius";
import { PumpFunSDK } from "../lib/pump";

export const handler: Handler = async () => {
    let mode = (await redis.get<string>(redisKeys.mode)) || "pumpswap";

    let priceSol = 0;
    let marketCapSol = 0;
    let curveProgress = 0;

    if (mode === "pumpswap") {
        try {
            const pump = new PumpFunSDK(connection);
            const state = await pump.getBondingCurveState(TOKEN_CONFIG.mint);

            if (state) {
                const vSol = Number(state.virtualSolReserves) / 1e9;

                // Strict Pre-Launch Detection (vSol Ground Truth)
                // If vSol is < 30.05, we are still dormant.
                if (vSol < 30.05) {
                    mode = "pre-launch";
                    await redis.set(redisKeys.mode, "pre-launch");
                } else if (mode === "pre-launch") {
                    // If we see volume, upgrade to pumpswap
                    mode = "pumpswap";
                    await redis.set(redisKeys.mode, "pumpswap");
                }

                priceSol = pump.calculatePrice(state);
                curveProgress = pump.calculateProgress(state);

                // Pump tokens: 6 decimals. Supply is usually 1B.
                const supply = Number(state.tokenTotalSupply) / 1e6;
                marketCapSol = priceSol * supply;

                if (state.complete) {
                    console.log("Bonding curve complete! Switching to Raydium.");
                    await redis.set(redisKeys.mode, "raydium");
                    mode = "raydium";
                }
            } else {
                console.log("Bonding curve not found (Pre-Launch).");
                mode = "pre-launch";
                await redis.set(redisKeys.mode, "pre-launch");

                // Set Initial Values
                const INIT_VTOKEN = 1073000000;
                const INIT_VSOL = 30;
                priceSol = INIT_VSOL / INIT_VTOKEN;
                curveProgress = 0;
                marketCapSol = priceSol * 1000000000;
            }
        } catch (e) {
            console.error("PumpSwap polling error:", e);
        }
    }

    if (mode === "raydium") {
        const m = await getRaydiumMetrics();
        priceSol = m.priceSol;
        marketCapSol = m.marketCapSol;
        curveProgress = 100; // Fixed 100%
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
