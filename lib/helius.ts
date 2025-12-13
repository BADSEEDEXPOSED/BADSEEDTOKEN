// lib/helius.ts
import { ENV } from "./env";

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`;

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

/** Placeholder for Raydium metrics – returns zeros until real implementation */
export async function getRaydiumMetrics() {
    return { priceSol: 0, marketCapSol: 0 };
}
