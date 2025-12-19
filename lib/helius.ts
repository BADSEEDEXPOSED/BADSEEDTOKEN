// lib/helius.ts
import { ENV } from "./env";

const HELIUS_RPC_URL = ENV.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com";

import { Connection } from "@solana/web3.js";
export const connection = new Connection(HELIUS_RPC_URL);

/** Robust RPC wrapper with Multi-Provider Fallback */
export async function heliusRpc<T = any>(method: string, params: any[]): Promise<T> {
    const payload = { jsonrpc: "2.0", id: 1, method, params };

    // Attempt 1: Helius (Primary)
    try {
        const res = await fetch(HELIUS_RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const json = await res.json();
            if (!json.error) return json.result as T;
            console.warn(`Helius JSON-RPC Error: ${JSON.stringify(json.error)}`);
        } else {
            console.warn(`Helius HTTP Error: ${res.status}`);
        }
    } catch (e) {
        console.warn("Helius Connection Failed:", e);
    }

    // Attempt 2: QuickNode (Fallback)
    if (ENV.QUICKNODE_RPC_URL) {
        console.log("Switching to QuickNode Fallback...");
        try {
            const res = await fetch(ENV.QUICKNODE_RPC_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`QuickNode HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(`QuickNode JSON-RPC Error: ${JSON.stringify(json.error)}`);

            return json.result as T;
        } catch (e) {
            console.error("QuickNode Fallback Failed:", e);
        }
    }

    throw new Error("All RPC providers failed.");
}

/** Fetch Token Total Supply (Returns number of tokens) */
export async function getTokenSupply(mint: string): Promise<number> {
    try {
        const result = await heliusRpc<{ value: { amount: string; decimals: number; uiAmount: number } }>("getTokenSupply", [mint]);
        return result.value.uiAmount || 0;
    } catch (e) {
        console.warn(`Error fetching supply for ${mint}:`, e);
        return 1000000000; // Fallback to 1B
    }
}

/** Fetch Token Balance for a Specific Wallet (Returns number of tokens) */
export async function getTokenBalance(wallet: string, mint: string): Promise<number> {
    try {
        const result = await heliusRpc<{ value: Array<{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }> }>("getTokenAccountsByOwner", [
            wallet,
            { mint: mint },
            { encoding: "jsonParsed" }
        ]);

        if (result.value && result.value.length > 0) {
            return result.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
        return 0;
    } catch (e) {
        console.warn(`Error fetching balance for ${wallet}:`, e);
        return 0;
    }
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
