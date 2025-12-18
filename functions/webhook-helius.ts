// functions/webhook-helius.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";
import { ENV } from "@lib/env";

export const handler: Handler = async (event) => {
    // 1. Basic Security
    const authHeader = event.headers["authorization"];
    const expectedSecret = ENV.WEBHOOK_AUTH_TOKEN || "superfancysecretbadseed"; // User should set this in Netlify

    if (authHeader !== expectedSecret) {
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
            if (tx.type === "SOL_TRANSFER" && !tx.error) {
                // Check each transfer within the transaction
                // Webhook data usually has simplified 'nativeTransfers'
                const transfers = tx.nativeTransfers || [];
                for (const transfer of transfers) {
                    if (
                        transfer.fromUserAccount === TOKEN_CONFIG.creatorWallet &&
                        transfer.toUserAccount === TOKEN_CONFIG.donationWallet
                    ) {
                        const sol = transfer.amount / 1e9;
                        donatedDelta += sol;
                        lastSignature = tx.signature;
                        console.log(`Webhook detected transfer: ${sol} SOL from ${tx.signature}`);
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
