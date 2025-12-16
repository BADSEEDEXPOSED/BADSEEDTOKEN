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

    // Placeholder: claim creator fees from Pump.fun (not implemented)
    const balanceLamports = await connection.getBalance(creator.publicKey);
    const balanceSol = balanceLamports / 1e9;

    const minBufferSol = 0.01;
    if (balanceSol <= minBufferSol) {
        return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Not enough SOL to forward after buffer." }) };
    }

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

    const sig = await connection.sendTransaction(tx, [creator]);
    await connection.confirmTransaction(sig, "confirmed");

    const now = Date.now();
    const amountSol = lamportsToSend / 1e9;

    const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary)) || {};
    const existingFees = parseFloat(summary.total_fees_claimed_sol || "0") || 0;
    const existingDonated = parseFloat(summary.total_donated_sol || "0") || 0;
    const existingPreLaunch = parseFloat(summary.pre_launch_donated_sol || "0") || 0;
    const currentMode = summary.mode || "pre-launch";

    const newFees = existingFees + amountSol;
    const newDonated = existingDonated + amountSol;

    // Conditional Tracking: If we are in pre-launch, this transfer counts towards Seed Capital (Blue Bar)
    let newPreLaunch = existingPreLaunch;
    if (currentMode === "pre-launch") {
        newPreLaunch += amountSol;
    }

    await redis.hmset(redisKeys.summary, {
        ...summary,
        total_fees_claimed_sol: newFees.toString(),
        total_donated_sol: newDonated.toString(),
        pre_launch_donated_sol: newPreLaunch.toString(),
        last_updated: new Date(now).toISOString()
    });

    const donationEvent = JSON.stringify({ tx: sig, amount_sol: amountSol, t: now });
    await redis.zadd(redisKeys.donations, { score: now, member: donationEvent });

    const feesCumPoint = JSON.stringify({ t: now, amount_sol: newFees });
    const donationsCumPoint = JSON.stringify({ t: now, amount_sol: newDonated });
    await redis.zadd(redisKeys.tsFeesCum, { score: now, member: feesCumPoint });
    await redis.zadd(redisKeys.tsDonationsCum, { score: now, member: donationsCumPoint });

    return { statusCode: 200, body: JSON.stringify({ ok: true, forwarded: amountSol, sig }) };
};
