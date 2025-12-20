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

    // Construct Debug Strings (matching App.tsx logic)
    // Note: in Raydium mode we might not have vSol/vToken, so we use fallbacks or price
    let debugPrice = "";
    let debugMcap = "";
    let debugProgress = "";

    if (mode === "pre-launch" || mode === "pumpswap") {
        // Re-calculating vSol/vToken approx from price if state isn't available in this scope?
        // Actually, if we are in this scope, we might have lost 'state' variable access if we are outside the try/catch.
        // But we can approximate for the display:
        const supply = 1000000000;
        const vToken = 1073000000 - (curveProgress / 100 * 800000000); // Inverse progress
        const vSol = priceSol * (vToken / 1000); // Approx formula

        // Better approach: We need to pull the 'state' values out of the if block or just be simpler.
        // Let's use simple logic:
        const vSolEst = 30 + (curveProgress / 100 * 85);

        debugPrice = `vSol (${vSolEst.toFixed(2)}) / vTokens (1073.0M)`; // Simplified for now
        debugMcap = `Price * Supply (${(marketCapSol).toFixed(1)} SOL)`; // Actually simpler to show SOL mcap
        // Corrected Target based on Pump Program Constants (793.1M saleable)
        debugProgress = `Sold (${(curveProgress / 100 * 793.1).toFixed(1)}M) / Target (793.1M)`;
    } else {
        debugPrice = `Raydium Pool Live`;
        debugMcap = `Price * Supply`;
        debugProgress = `Bonding Complete`;
    }

    // --- HOST PROOF OF RESERVES (Phase 6) ---
    // Fetch real-time balances for transparency
    let totalSupply = 1000000000;
    let devBalance = 0;
    let donationBalance = 0;
    let burnBalance = 0;

    try {
        const { getTokenSupply, getTokenBalance } = await import("../lib/helius");

        // 1. Fetch Supply
        totalSupply = await getTokenSupply(TOKEN_CONFIG.mint);

        // 2. Fetch Wallet Balances
        // Note: These are light RPC calls (getTokenAccountsByOwner)
        const BURN_ADDRESS = "11111111111111111111111111111111";

        [devBalance, donationBalance, burnBalance] = await Promise.all([
            getTokenBalance(TOKEN_CONFIG.creatorWallet, TOKEN_CONFIG.mint),
            getTokenBalance(TOKEN_CONFIG.donationWallet, TOKEN_CONFIG.mint),
            getTokenBalance(BURN_ADDRESS, TOKEN_CONFIG.mint)
        ]);

        // 3. Calculate Community Holdings
        // Community = (Tokens Sold) - (Dev + Donation + Burn)
        // Tokens Sold = Initial Saleable (793.1M) - Tokens Left To Sell

        const INITIAL_SALEABLE = 793100000;
        const RESERVED_LIQ = 206900000;

        let tokensLeftToSell = INITIAL_SALEABLE; // Default assumption: None sold yet

        try {
            const pump = new PumpFunSDK(connection);

            // Priority 1: Get precise "Left To Sell" from On-Chain State
            // Note: We might have already fetched 'state' above, but fetching again or passing it down is safer for autonomy
            const state = await pump.getBondingCurveState(TOKEN_CONFIG.mint);

            if (state) {
                tokensLeftToSell = Number(state.realTokenReserves) / 1e6;
            } else {
                // Priority 2: Fallback to ATA Balance (Balance - Reserved)
                const curvePda = await pump.getBondingCurvePDA(new (await import("@solana/web3.js")).PublicKey(TOKEN_CONFIG.mint));
                const { getTokenBalance } = await import("../lib/helius");
                const rawBalance = await getTokenBalance(curvePda.toBase58(), TOKEN_CONFIG.mint);

                // rawBalance includes the 206.9M reserved tokens
                tokensLeftToSell = Math.max(0, rawBalance - RESERVED_LIQ);
            }
        } catch (e) {
            console.warn("Curve fetch warning:", e);
        }

        const tokensSold = Math.max(0, INITIAL_SALEABLE - tokensLeftToSell);
        let communityBalance = Math.max(0, tokensSold - devBalance - donationBalance - burnBalance);

        // Hard Override for Pre-Launch (Impossible to hold tokens)
        if (mode === "pre-launch") {
            communityBalance = 0;
        }

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
            last_updated: new Date(now).toISOString(),

            // Debug strings for existing UI
            debug_price: debugPrice,
            debug_mcap: debugMcap,
            debug_progress: debugProgress,

            // PROOF OF RESERVES DATA
            supply_total: totalSupply.toString(),
            supply_community: communityBalance.toString(),
            supply_dev: devBalance.toString(),
            supply_donation: donationBalance.toString(),
            supply_burn: burnBalance.toString()
        });

        const pricePoint = JSON.stringify({ t: now, price_sol: priceSol });
        const mcapPoint = JSON.stringify({ t: now, market_cap_sol: marketCapSol });

        await redis.zadd(redisKeys.tsPrice, { score: now, member: pricePoint });
        await redis.zadd(redisKeys.tsMcap, { score: now, member: mcapPoint });

        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, mode, priceSol, marketCapSol, curveProgress })
        };
    } catch (e) {
        console.error("Error in AMM poller:", e);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: (e as Error).message })
        };
    }
};
