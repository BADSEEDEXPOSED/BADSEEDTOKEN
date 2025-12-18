// lib/helius.ts
import { ENV } from "./env";

const HELIUS_RPC_URL = ENV.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com";

import { Connection } from "@solana/web3.js";
export const connection = new Connection(HELIUS_RPC_URL);

/** Minimal JSON-RPC wrapper for Helius */
export async function heliusRpc<T = any>(method: string, params: any[]): Promise<T> {
    const res = await fetch(HELIUS_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    });
    if (!res.ok) {
        throw new Error(`Helius RPC error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    if (json.error) {
        throw new Error(`Helius RPC error: ${JSON.stringify(json.error)}`);
    }
    return json.result as T;
}

/** Placeholder for Pump AMM metrics – returns zeros until real implementation */
export async function getPumpAmmMetrics() {
    return { priceSol: 0, marketCapSol: 0, curveProgress: 0 };
}

/** Real implementation using Jupiter Price API for post-migration data */
export async function getRaydiumMetrics() {
    try {
        const MINT = "3HPpMLK7LjKFqSnCsBYNiijhNTo7dkkx3FCSAHKSpump";
        // Fetch price in SOL (vsToken = wSOL)
        // wSOL = So11111111111111111111111111111111111111112
        const url = `https://api.jup.ag/price/v2?ids=${MINT}&vsToken=So11111111111111111111111111111111111111112`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Jupiter API failed");

        const json = await res.json();
        const data = json.data[MINT];

        if (!data || !data.price) {
            return { priceSol: 0, marketCapSol: 0 };
        }

        const priceSol = parseFloat(data.price);
        // Standard supply is 1B for Pump.fun tokens
        const marketCapSol = priceSol * 1000000000;

        return { priceSol, marketCapSol };

    } catch (e) {
        console.warn("Error fetching Raydium/Jupiter metrics:", e);
        return { priceSol: 0, marketCapSol: 0 };
    }
}
