// lib/helius.ts
import { Connection } from "@solana/web3.js";
import { ENV } from "./env";

const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";

export function getHeliusRpcUrl(): string {
    return ENV.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`
        : PUBLIC_SOLANA_RPC;
}

let cachedUrl = "";
let cachedConnection: Connection | null = null;

export function getConnection(): Connection {
    const url = getHeliusRpcUrl();
    if (!cachedConnection || cachedUrl !== url) {
        cachedUrl = url;
        cachedConnection = new Connection(url);
    }
    return cachedConnection;
}

// Dynamic proxy so existing `import { connection }` always uses the live Helius RPC URL
export const connection = new Proxy({} as Connection, {
    get(_target, prop) {
        const conn = getConnection();
        const val = (conn as any)[prop];
        return typeof val === "function" ? val.bind(conn) : val;
    },
});

/** Robust 3-tier RPC wrapper: Helius -> QuickNode (if set) -> Public Solana Mainnet */
export async function heliusRpc<T = any>(method: string, params: any[]): Promise<T> {
    const payload = { jsonrpc: "2.0", id: 1, method, params };
    const endpoints: string[] = [];
    const primary = getHeliusRpcUrl();
    endpoints.push(primary);
    if (ENV.QUICKNODE_RPC_URL && !endpoints.includes(ENV.QUICKNODE_RPC_URL)) {
        endpoints.push(ENV.QUICKNODE_RPC_URL);
    }
    if (!endpoints.includes(PUBLIC_SOLANA_RPC)) {
        endpoints.push(PUBLIC_SOLANA_RPC);
    }

    let lastErr: unknown = null;
    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
                const json = await res.json();
                if (!json.error) return json.result as T;
                lastErr = json.error;
                console.warn(`RPC JSON Error (${url.slice(0, 32)}):`, JSON.stringify(json.error));
            } else {
                lastErr = `HTTP ${res.status}`;
                console.warn(`RPC HTTP ${res.status} (${url.slice(0, 32)})`);
            }
        } catch (e) {
            lastErr = e;
            console.warn(`RPC fetch failed (${url.slice(0, 32)}):`, e);
        }
    }

    throw new Error(`All RPC providers failed (${String(lastErr)})`);
}

/** Fetch Token Total Supply (Returns number of tokens) */
export async function getTokenSupply(mint: string): Promise<number> {
    try {
        const result = await heliusRpc<{ value: { amount: string; decimals: number; uiAmount: number } }>("getTokenSupply", [mint]);
        return result.value.uiAmount || 0;
    } catch (e) {
        console.warn(`Error fetching supply for ${mint}:`, e);
        throw new Error("Token supply unavailable");
    }
}

/** Fetch Token Balance for a Specific Wallet (Returns number of tokens) */
export async function getTokenBalance(wallet: string, mint: string): Promise<number> {
    try {
        const result = await heliusRpc<{ value: Array<{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }> }>("getTokenAccountsByOwner", [
            wallet,
            { mint: mint },
            { encoding: "jsonParsed" },
        ]);

        if (result.value && result.value.length > 0) {
            return result.value.reduce((sum, entry) => sum + (entry.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
        }
        return 0;
    } catch (e) {
        throw new Error("Token balance unavailable");
    }
}

export async function getPumpAmmMetrics() {
    return { priceSol: 0, marketCapSol: 0, curveProgress: 0 };
}

/** Post-migration market metrics via DexScreener */
export async function getPumpSwapMetrics() {
    const { TOKEN_CONFIG } = await import("./tokenConfig");
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${TOKEN_CONFIG.mint}`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error("Market provider unavailable");
    const pairs = await res.json();
    const pair = pairs
        .filter((p: any) => p.baseToken?.address === TOKEN_CONFIG.mint && p.quoteToken?.address === "So11111111111111111111111111111111111111112")
        .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const priceSol = Number(pair?.priceNative);
    if (!(priceSol > 0)) throw new Error("No funded SOL market available");
    const supply = await getTokenSupply(TOKEN_CONFIG.mint);
    return { priceSol, marketCapSol: priceSol * supply };
}
