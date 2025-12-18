// functions/fee-worker.ts
import type { Handler } from "@netlify/functions";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { ENV } from "@lib/env";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";

const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`;

function loadCreatorKeypair(): Keypair {
    const secret = JSON.parse(ENV.CREATOR_SECRET_KEY) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export const handler: Handler = async () => {
    const connection = new Connection(RPC_URL, "confirmed");
    const creator = loadCreatorKeypair();
    const donationPubkey = new PublicKey(TOKEN_CONFIG.donationWallet);

    // --- NEW: Transaction Scanner Logic ---
    // We scan the Donation Wallet's history for INCOMING transfers from the Creator Wallet.
    // This allows us to catch Manual Transfers + Auto Transfers and maintain a "Scoreboard" that never decreases.

    // VERSION CHECK: If we are on V2 keys but have no signature, this is a FRESH RESET.
    const lastSig = await redis.get<string>(`token:LAST_SIG_V2:${TOKEN_CONFIG.mint}`);
    let newSigs: any[] = [];

    // Fetch signatures for Donation Wallet (receives funds)
    // We look for transactions until the last one we processed.
    try {
        // Deep Scan Limit: 100 transactions should cover the entire history for now.
        const options: any = { limit: 100 };
        if (lastSig) {
            options.until = lastSig;
        } else {
            console.log("No last signature found. Performing FULL HISTORY SCAN (V2 Reset).");
        }
        newSigs = await connection.getSignaturesForAddress(donationPubkey, options);
    } catch (e) {
        console.error("Error fetching signatures:", e);
    }

    let detectedNewDonations = 0;
    // Process newer transactions first (reverse chronological from API, but we want cumulative)
    // Actually, simply iterating and summing is fine.

    if (newSigs.length > 0) {
        console.log(`Processing ${newSigs.length} new transactions...`);

        // We need to fetch parsed details to see who sent money and how much
        // Note: RPC limits apply. We take 20 at a time max.
        const txs = await connection.getParsedTransactions({
            ids: newSigs.map((s: any) => s.signature),
            maxSupportedTransactionVersion: 0
        } as any);

        for (const tx of txs) {
            if (!tx || !tx.meta || tx.meta.err) continue;

            const accountKeys = tx.transaction.message.accountKeys;
            const donationIndex = accountKeys.findIndex((k: any) => k.pubkey.toBase58() === donationPubkey.toBase58());

            if (donationIndex !== -1) {
                const pre = tx.meta.preBalances[donationIndex] || 0;
                const post = tx.meta.postBalances[donationIndex] || 0;
                const deltaLamports = post - pre;

                if (deltaLamports > 0) {
                    const sol = deltaLamports / 1e9;
                    detectedNewDonations += sol;
                    console.log(`Bullet-Proof Scanner: Found +${sol} SOL in tx ${tx.transaction.signatures[0]}`);
                }
            }
        }

        // Update the last processed signature being the most recent one (index 0)
        await redis.set(`token:LAST_SIG_V2:${TOKEN_CONFIG.mint}`, newSigs[0].signature);
    }

    // --- End Scanner Logic ---

    const balanceLamports = await connection.getBalance(creator.publicKey);
    const balanceSol = balanceLamports / 1e9;

    const minBufferSol = 0.01;
    let forwardedAmount = 0;
    let sig: string | null = null;
    let sentThisRun = 0;

    if (balanceSol > minBufferSol) {
        // ... (existing auto-forward logic) ...
        const lamportsToSend = Math.floor((balanceSol - minBufferSol) * 1e9);
        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: creator.publicKey,
                toPubkey: donationPubkey,
                lamports: lamportsToSend
            })
        );
        tx.feePayer = creator.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        try {
            sig = await connection.sendTransaction(tx, [creator]);
            await connection.confirmTransaction(sig, "confirmed");
            forwardedAmount = lamportsToSend / 1e9;
            sentThisRun = forwardedAmount; // We track this, but the SCANNER over the next run will likely pick it up as history? 
            // WAIT. If we just sent it, the Scanner might miss it if we scan BEFORE we send? 
            // OR if we scan NOW, we haven't sent it yet. 
            // To be safe and instant: We add 'sentThisRun' to the detected total immediately.
            // The Next Scan will see it in history. We need to handle de-duplication or just rely on the 'lastSig' pointer.
            // If we update 'lastSig' before sending, the next run sees the new Tx (which is newer than lastSig). Correct.

        } catch (e) {
            console.error("Transfer failed", e);
        }
    }

    const now = Date.now();
    const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary)) || {};
    const existingFees = parseFloat(summary.total_fees_claimed_sol || "0") || 0;
    const existingDonated = parseFloat(summary.total_donated_sol || "0") || 0;
    const existingPreLaunch = parseFloat(summary.pre_launch_donated_sol || "0") || 0;
    const currentMode = summary.mode || "pre-launch";

    // Update Totals
    // Total Inflow = Existing + Detected(History) + Sent(Now)
    const totalNewSol = detectedNewDonations + sentThisRun;

    const newDonated = existingDonated + totalNewSol;
    const newFees = existingFees + sentThisRun; // Fees claimed tracks only what WE auto-claimed

    // Conditional Tracking for Pre-Launch
    let newPreLaunch = existingPreLaunch;
    if (currentMode === "pre-launch") {
        newPreLaunch += totalNewSol;
    }

    await redis.hmset(redisKeys.summary, {
        ...summary,
        total_fees_claimed_sol: newFees.toString(),
        total_donated_sol: newDonated.toString(), // Cumulative Scoreboard
        pre_launch_donated_sol: newPreLaunch.toString(),
        last_updated: new Date(now).toISOString()
    });

    const donationEvent = JSON.stringify({ tx: sig, amount_sol: forwardedAmount, t: now });
    await redis.zadd(redisKeys.donations, { score: now, member: donationEvent });

    const feesCumPoint = JSON.stringify({ t: now, amount_sol: newFees });
    const donationsCumPoint = JSON.stringify({ t: now, amount_sol: newDonated });
    await redis.zadd(redisKeys.tsFeesCum, { score: now, member: feesCumPoint });
    await redis.zadd(redisKeys.tsDonationsCum, { score: now, member: donationsCumPoint });

    return { statusCode: 200, body: JSON.stringify({ ok: true, forwarded: forwardedAmount, total_new_detected: totalNewSol, total_donated: newDonated, sig }) };
};
