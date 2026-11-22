import * as crypto from "crypto";
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";
import { ENV } from "@lib/env";

export const handler: Handler = async (event) => {
    // 1. Secure Authentication (Timing-Safe)
    const authHeader = event.headers["authorization"] || "";
    const expectedSecret = ENV.WEBHOOK_AUTH_TOKEN;
    if (!expectedSecret) {
        console.error("WEBHOOK_AUTH_TOKEN is not configured");
        return { statusCode: 503, body: "Webhook unavailable" };
    }

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
            if (!tx?.signature) continue;
            // Helius retries deliveries. Claim each signature once so retries cannot
            // inflate donation totals or order-flow counts.
            const claimed = await redis.set(`token:WEBHOOK_SEEN_V1:${tx.signature}`, "1", { nx: true, ex: 7 * 86400 });
            if (!claimed) continue;
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

            // STRATEGY 3: Real-Time Order Flow (Capture Pump.fun & PumpSwap Buys/Sells)
            // In Helius Enhanced Txs, tokenBalanceChanges often live on the user's ATA entry (userAccount === feePayer)
            let netTokenDelta = 0;
            let traderSolDelta = 0;
            if (tx.accountData && Array.isArray(tx.accountData)) {
                const feePayerEntry = tx.accountData.find((a: any) => a.account === tx.feePayer);
                if (feePayerEntry) traderSolDelta = Number(feePayerEntry.nativeBalanceChange || 0) / 1e9;

                for (const entry of tx.accountData) {
                    if (!Array.isArray(entry.tokenBalanceChanges)) continue;
                    for (const t of entry.tokenBalanceChanges) {
                        if (t.mint !== TOKEN_CONFIG.mint) continue;
                        if (t.userAccount === tx.feePayer || entry.account === tx.feePayer) {
                            const rawAmount = t.rawTokenAmount ? parseFloat(t.rawTokenAmount.tokenAmount) : 0;
                            const decimals = t.rawTokenAmount ? t.rawTokenAmount.decimals : 6;
                            netTokenDelta += rawAmount / Math.pow(10, decimals);
                        }
                    }
                }
            }
            if (netTokenDelta === 0 && Array.isArray(tx.tokenTransfers)) {
                for (const tr of tx.tokenTransfers) {
                    if (tr.mint !== TOKEN_CONFIG.mint) continue;
                    const amt = Number(tr.tokenAmount || 0);
                    if (tr.toUserAccount === tx.feePayer) netTokenDelta += amt;
                    else if (tr.fromUserAccount === tx.feePayer) netTokenDelta -= amt;
                }
            }
            if (netTokenDelta !== 0) {
                const isBuy = netTokenDelta > 0;
                const absAmount = Math.abs(netTokenDelta);
                const action = isBuy ? "Buy" : "Sell";
                const msg = `${action}: ${absAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${TOKEN_CONFIG.symbol}`;
                const key = `token:RECENT_ACTIVITY:${TOKEN_CONFIG.mint}`;
                await redis.lpush(key, msg);
                await redis.ltrim(key, 0, 9);

                const eventTime = Number(tx.timestamp || Math.floor(Date.now() / 1000)) * 1000;
                const activity = {
                    signature: tx.signature,
                    timestamp: eventTime,
                    side: isBuy ? "buy" : "sell",
                    token_amount: absAmount,
                    sol_amount: traderSolDelta ? Math.abs(traderSolDelta) : null,
                    maker: tx.feePayer || "",
                    tier: absAmount > 1000000 ? "large" : "standard",
                };
                const activityKey = `token:ACTIVITY_V2:${TOKEN_CONFIG.mint}`;
                await redis.zadd(activityKey, { score: eventTime, member: JSON.stringify(activity) });
                await redis.zremrangebyscore(activityKey, 0, Date.now() - 7 * 86400000);

                console.log(`[Ticker] ${msg}`);
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
