
import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";

// Load env vars if locally running, but since we are running via tool we might need to hardcode or generic load
// We will try to read from process.env if available or just use the key if we can read the file.
// Actually, for this script to work in this environment, I'll use the existing env helper principle or just mostly rely on standard fetch if web3.js is too heavy/not configed.
// actually let's use the existing helper structure if possible, but simplest is just fetch.

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "7857ba5a-6481-4c5c-a49b-7230a73beb17";
// I will rely on the user having the .env file or I will try to read it.
// Wait, I can't read the .env file directly usually if it is not in the file list.
// I will assume I can use the existing 'lib/env.ts' if I run with tsx.

// Let's try to query the Helius RPC method 'getEnhancedTransactions' which is what the webhook sends.

const TX_SIG = "4BdkkpJ9CPxt3PC7N3a6YdY66Fu3ehpMAy5Ri2wutYnj9gi6rNrXadV1Nf2M3wTxNJKMrdevZm6pjUGVTZzFi8rE";
const API_URL = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`;

async function run() {
    console.log("Fetching processed transaction from Helius...");

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            transactions: [TX_SIG]
        }),
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
