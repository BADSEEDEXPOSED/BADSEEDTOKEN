import * as crypto from "crypto";
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";
import { ENV } from "@lib/env";

export const handler: Handler = async (event) => {
    // 1. Secure Authentication (Timing-Safe)
    const authHeader = event.headers["authorization"] || "";
    const expectedSecret = ENV.WEBHOOK_AUTH_TOKEN || "superfancysecretbadseed";

    const received = Buffer.from(authHeader);
    const expected = Buffer.from(expectedSecret);

    // Constant-time comparison to prevent timing attacks
    let match = received.length === expected.length;
    if (match) {
        match = crypto.timingSafeEqual(received, expected);
    }

    if (!match) {
        console.warn("Unauthorized webhook attempt blocked.");
        return { statusCode: 401, body: "Unauthorized" };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // Helius sends an array of "Enhanced Transaction" objects
        const transactions = JSON.parse(event.body || "[]");
        console.log(`Received webhook for ${transactions.length} transactions`);

        const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary)) || {};
        let donatedDelta = 0;
        let lastSignature = null;

        for (const tx of transactions) {
            let txSol = 0;

            // STRATEGY 1: Balance Delta (Accurate)
            if (tx.accountData && Array.isArray(tx.accountData)) {
                for (const accountEntry of tx.accountData) {
                    if (
                        accountEntry.account === TOKEN_CONFIG.donationWallet &&
                        accountEntry.nativeBalanceChange > 0
                    ) {
                        txSol += accountEntry.nativeBalanceChange / 1e9;
                        console.log(`[Method:Delta] Detected +${txSol} SOL in ${tx.signature}`);
                    }
                }
            }

            // STRATEGY 2: Native Transfers (Legacy Fallback)
            // If Strategy 1 missed it (e.g. Helius data quirk), this usually catches simple sends.
            if (txSol === 0 && tx.nativeTransfers && Array.isArray(tx.nativeTransfers)) {
                for (const transfer of tx.nativeTransfers) {
                    if (transfer.toUserAccount === TOKEN_CONFIG.donationWallet) {
                        const amount = transfer.amount / 1e9;
                        txSol += amount;
                        console.log(`[Method:Legacy] Detected +${amount} SOL in ${tx.signature}`);
                    }
                }
            }

            if (txSol > 0) {
                donatedDelta += txSol;
                lastSignature = tx.signature;
            }

            // STRATEGY 3: Real-Time Ticker (Capture Buys/Sells)
            // Enhanced Logic: Analyze Volume & Direction via AccountData
            if (tx.accountData && Array.isArray(tx.accountData)) {
                // Find the user who paid for the tx (likely the trader)
                const trader = tx.accountData.find(a => a.account === tx.feePayer);

                if (trader && trader.tokenBalanceChanges && Array.isArray(trader.tokenBalanceChanges)) {
                    // Check if this trader traded OUR token
                    const tokenChange = trader.tokenBalanceChanges.find(t => t.mint === TOKEN_CONFIG.mint);

                    if (tokenChange) {
                        const rawAmount = tokenChange.rawTokenAmount ? parseFloat(tokenChange.rawTokenAmount.tokenAmount) : 0;
                        const decimals = tokenChange.rawTokenAmount ? tokenChange.rawTokenAmount.decimals : 6;
                        const changeAmount = rawAmount / Math.pow(10, decimals);

                        // Determine Direction
                        // Positive Change = User Bought (Gained Tokens)
                        // Negative Change = User Sold (Lost Tokens)
                        const isBuy = changeAmount > 0;
                        const absAmount = Math.abs(changeAmount);

                        if (absAmount > 0) {
                            let emoji = isBuy ? "🟢" : "🔴";
                            let action = isBuy ? "Buy" : "Sell";

                            // Whale Alert (>1M Tokens)
                            if (absAmount > 1000000) {
                                emoji = isBuy ? "🐳" : "🦈";
                                action = isBuy ? "Whale Buy" : "Whale Dump";
                            }

                            const msg = `${emoji} ${action}: ${absAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${TOKEN_CONFIG.symbol}`;

                            // Push to Redis (Temporarily Disabled for Debugging)
                            // const key = `token:RECENT_ACTIVITY:${TOKEN_CONFIG.mint}`;
                            // await redis.lpush(key, msg);
                            // await redis.ltrim(key, 0, 9);

                            console.log(`[Ticker] ${msg}`);
                        }
                    }
                }
            }
        }

        if (donatedDelta > 0) {
            const existingDonated = parseFloat(summary.total_donated_sol || "0") || 0;
            const existingPreLaunch = parseFloat(summary.pre_launch_donated_sol || "0") || 0;
            const currentMode = summary.mode || "pre-launch";

            const newDonated = existingDonated + donatedDelta;
            let newPreLaunch = existingPreLaunch;
            if (currentMode === "pre-launch") {
                newPreLaunch += donatedDelta;
            }

            await redis.hmset(redisKeys.summary, {
                ...summary,
                total_donated_sol: newDonated.toString(),
                pre_launch_donated_sol: newPreLaunch.toString(),
                last_updated: new Date().toISOString()
            });

            // Update the last signature so the fee-worker skips these on its next run
            if (lastSignature) {
                await redis.set(`token:LAST_SIG_V2:${TOKEN_CONFIG.mint}`, lastSignature);
            }

            console.log(`Webhook updated summary: +${donatedDelta} SOL`);
        }

        return { statusCode: 200, body: JSON.stringify({ ok: true, detected: donatedDelta }) };
    } catch (e) {
        console.error("Webhook processing error:", e);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};
