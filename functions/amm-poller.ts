// functions/amm-poller.ts
import type { Handler } from "@netlify/functions";
import { redis } from "../lib/redis";
import { redisKeys, TOKEN_CONFIG } from "../lib/tokenConfig";
import { getPumpSwapMetrics, connection } from "../lib/helius";

// Milestone tracking key (for Agent historical context - additive only)
const MILESTONES_KEY = `token:MILESTONES_V1:${TOKEN_CONFIG.mint}`;
import { PumpFunSDK } from "../lib/pump";

export const handler: Handler = async () => {
    let mode = (await redis.get<string>(redisKeys.mode)) || "pre-launch";

    let priceSol = 0;
    let marketCapSol = 0;
    let curveProgress = 0;
    let curveState: import("../lib/pump").BondingCurveState | null = null;

    {
        try {
            const pump = new PumpFunSDK(connection);
            const state = await pump.getBondingCurveState(TOKEN_CONFIG.mint);

            if (state) {
                curveState = state;
                mode = state.complete ? "pumpswap" : "bonding-curve";
                await redis.set(redisKeys.mode, mode);

                priceSol = pump.calculatePrice(state);
                curveProgress = pump.calculateProgress(state);

                // Pump tokens: 6 decimals. Supply is usually 1B.
                const supply = Number(state.tokenTotalSupply) / 1e6;
                marketCapSol = priceSol * supply;

                if (state.complete) console.log("Bonding curve complete. Reading the PumpSwap market.");
            } else {
                console.log("Bonding curve not found (Pre-Launch).");
                mode = "pre-launch";
                await redis.set(redisKeys.mode, "pre-launch");

                priceSol = 0;
                curveProgress = 0;
                marketCapSol = 0;
            }
        } catch (e) {
            await redis.hset(redisKeys.summary, { data_status: "unavailable", last_checked: new Date().toISOString() });
            return { statusCode: 503, body: JSON.stringify({ error: "Market lookup failed" }) };
        }
    }

    if (mode === "pumpswap") {
        let m;
        try { m = await getPumpSwapMetrics(); } catch {
            await redis.hset(redisKeys.summary, { data_status: "unavailable", last_checked: new Date().toISOString() });
            return { statusCode: 503, body: JSON.stringify({ error: "Migrated market unavailable" }) };
        }
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

    if (mode === "pre-launch" || mode === "bonding-curve") {
        const vSol = curveState ? Number(curveState.virtualSolReserves) / 1e9 : 30;
        const vToken = curveState ? Number(curveState.virtualTokenReserves) / 1e6 : 1073000000;
        const remaining = curveState ? Number(curveState.realTokenReserves) / 1e6 : 793100000;
        const sold = Math.max(0, 793100000 - remaining);
        debugPrice = `vSOL (${vSol.toFixed(2)}) / vTokens (${(vToken / 1e6).toFixed(1)}M)`;
        debugMcap = mode === "pre-launch" ? `Starting Price * Planned Supply (${(30 / 1073000000 * 1000000000).toFixed(1)} SOL)` : `Price * On-chain Supply (${marketCapSol.toFixed(1)} SOL)`;
        debugProgress = `Sold (${(sold / 1e6).toFixed(1)}M) / Curve (${(793100000 / 1e6).toFixed(1)}M)`;
    } else {
        debugPrice = `PumpSwap Pool Live`;
        debugMcap = `Price * Supply`;
        debugProgress = `Bonding Complete`;
    }

    // --- HOST PROOF OF RESERVES (Phase 6) ---
    // Fetch real-time balances for transparency
    let totalSupply = 0;
    let devBalance = 0;
    let donationBalance = 0;
    let burnBalance = 0;

    try {
        const { getTokenSupply, getTokenBalance } = await import("../lib/helius");

        // 1. Fetch Supply
        totalSupply = mode === "pre-launch" ? 0 : await getTokenSupply(TOKEN_CONFIG.mint);

        // 2. Fetch Wallet Balances
        // Note: These are light RPC calls (getTokenAccountsByOwner)
        const BURN_ADDRESS = "11111111111111111111111111111111";

        [devBalance, donationBalance, burnBalance] = mode === "pre-launch" ? [0, 0, 0] : await Promise.all([
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
            const state = mode === "pre-launch" ? null : await pump.getBondingCurveState(TOKEN_CONFIG.mint);

            if (state) {
                tokensLeftToSell = Number(state.realTokenReserves) / 1e6;
            } else if (mode !== "pre-launch") {
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
            data_status: mode === "pre-launch" ? "awaiting-launch" : (priceSol > 0 ? "live" : "unavailable"),
            last_checked: new Date(now).toISOString(),
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

        if (mode !== "pre-launch" && priceSol > 0) {
            await redis.zadd(redisKeys.tsPrice, { score: now, member: pricePoint });
            await redis.zadd(redisKeys.tsMcap, { score: now, member: mcapPoint });
        }

        // --- MILESTONE TRACKING (Additive - for Agent historical context) ---
        // Update ATH curve progress if current is higher
        try {
            const milestones = (await redis.hgetall<Record<string, string>>(MILESTONES_KEY)) || {};
            const storedAthProgress = parseFloat(milestones.ath_curve_progress || "0");
            const storedAthMcap = parseFloat(milestones.ath_market_cap_sol || "0");

            const updates: Record<string, string> = {};

            if (curveProgress > storedAthProgress) {
                updates.ath_curve_progress = curveProgress.toString();
                updates.ath_curve_progress_date = new Date(now).toISOString();
            }

            if (marketCapSol > storedAthMcap) {
                updates.ath_market_cap_sol = marketCapSol.toString();
                updates.ath_market_cap_date = new Date(now).toISOString();
            }

            // Always update last seen values
            updates.last_mode = mode;
            updates.last_updated = new Date(now).toISOString();

            if (Object.keys(updates).length > 0) {
                await redis.hmset(MILESTONES_KEY, updates);
            }
        } catch (milestoneErr) {
            // Non-critical: Don't fail the main poller if milestone tracking fails
            console.warn("Milestone tracking warning:", milestoneErr);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, mode, priceSol, marketCapSol, curveProgress })
        };
    } catch (e) {
        await redis.hset(redisKeys.summary, { data_status: "unavailable", last_checked: new Date().toISOString() });
        console.error("Error in AMM poller:", e);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: (e as Error).message })
        };
    }
};
