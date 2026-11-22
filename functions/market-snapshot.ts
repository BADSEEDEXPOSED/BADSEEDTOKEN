import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys, TOKEN_CONFIG } from "@lib/tokenConfig";

type Activity = { signature: string; timestamp: number; side: "buy" | "sell"; token_amount: number; sol_amount: number | null; maker: string; tier: "standard" | "large" };
const ACTIVITY_KEY = `token:ACTIVITY_V2:${TOKEN_CONFIG.mint}`;

function parseActivity(value: unknown): Activity | null {
    try {
        const item = typeof value === "string" ? JSON.parse(value) : value;
        if (!item || typeof item !== "object") return null;
        const candidate = item as Activity;
        return candidate.signature && (candidate.side === "buy" || candidate.side === "sell") ? candidate : null;
    } catch { return null; }
}

async function fetchSolUsdFallback(): Promise<number | null> {
    try {
        const r = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot", { signal: AbortSignal.timeout(4000) });
        if (r.ok) {
            const j = await r.json() as any;
            const amt = Number(j?.data?.amount);
            if (Number.isFinite(amt) && amt > 0) return amt;
        }
    } catch {}
    return null;
}

export const handler: Handler = async () => {
    const now = Date.now();
    const summary = (await redis.hgetall<Record<string, string>>(redisKeys.summary).catch(() => null)) || {};
    const mode = summary.mode || "pre-launch";
    const raw = await redis.zrange<unknown[]>(ACTIVITY_KEY, now - 86400000, now, { byScore: true }).catch(() => []);
    const activity = (raw || []).map(parseActivity).filter((item): item is Activity => Boolean(item));
    let buysCount = activity.filter(item => item.side === "buy").length;
    let sellsCount = activity.filter(item => item.side === "sell").length;
    const largeTrades24h = activity.filter(item => item.tier === "large").length;
    const measuredSol = activity.filter(item => item.sol_amount != null);
    const measuredVolSol = measuredSol.length ? measuredSol.reduce((sum, item) => sum + (item.sol_amount || 0), 0) : null;
    const netFlowSol = measuredSol.length
        ? measuredSol.reduce((sum, item) => sum + (item.side === "buy" ? (item.sol_amount || 0) : -(item.sol_amount || 0)), 0)
        : null;
    const makers = new Set(activity.map(item => item.maker).filter(Boolean)).size;

    let provider: "on-chain-stream" | "dexscreener" | "awaiting-launch" = mode === "pre-launch" ? "awaiting-launch" : "on-chain-stream";
    let liquidityUsd: number | null = null, fdvUsd: number | null = null, marketCapUsd: number | null = null;
    let volume24hUsd: number | null = null, priceChange1hPct: number | null = null, priceChange24hPct: number | null = null, priceUsd: number | null = null, pairUrl: string | null = null;

    if (mode !== "pre-launch") {
        try {
            const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${TOKEN_CONFIG.mint}`, { signal: AbortSignal.timeout(6000) });
            if (response.ok) {
                const pairs = await response.json() as any[];
                const pair = pairs
                    .filter(item => item.baseToken?.address === TOKEN_CONFIG.mint)
                    .sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
                if (pair) {
                    provider = "dexscreener";
                    const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
                    liquidityUsd = numeric(pair.liquidity?.usd);
                    fdvUsd = numeric(pair.fdv);
                    marketCapUsd = numeric(pair.marketCap);
                    volume24hUsd = numeric(pair.volume?.h24);
                    priceChange1hPct = numeric(pair.priceChange?.h1);
                    priceChange24hPct = numeric(pair.priceChange?.h24);
                    priceUsd = numeric(pair.priceUsd);
                    pairUrl = typeof pair.url === "string" ? pair.url : null;

                    const dsBuys = Number(pair.txns?.h24?.buys || 0);
                    const dsSells = Number(pair.txns?.h24?.sells || 0);
                    if (dsBuys > buysCount) buysCount = dsBuys;
                    if (dsSells > sellsCount) sellsCount = dsSells;
                }
            }
        } catch (error) {
            console.warn("Market snapshot provider unavailable", error);
        }

        if (marketCapUsd == null || priceUsd == null) {
            const priceSol = Number(summary.price_sol || 0);
            const mcapSol = Number(summary.market_cap_sol || 0);
            if (priceSol > 0 || mcapSol > 0) {
                const solUsd = await fetchSolUsdFallback();
                if (solUsd) {
                    if (priceUsd == null && priceSol > 0) priceUsd = priceSol * solUsd;
                    if (marketCapUsd == null && mcapSol > 0) marketCapUsd = mcapSol * solUsd;
                    if (fdvUsd == null && mcapSol > 0) fdvUsd = mcapSol * solUsd;
                    if (volume24hUsd == null && measuredVolSol != null) volume24hUsd = measuredVolSol * solUsd;
                }
            }
        }
    }

    const totalTrades = Math.max(activity.length, buysCount + sellsCount);

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=10" },
        body: JSON.stringify({
            status: mode === "pre-launch" ? "awaiting-launch" : (summary.data_status === "live" ? "live" : "delayed"),
            provider,
            measured_at: new Date(now).toISOString(),
            price_usd: priceUsd,
            liquidity_usd: liquidityUsd,
            fdv_usd: fdvUsd,
            market_cap_usd: marketCapUsd,
            volume_24h_usd: volume24hUsd,
            price_change_1h_pct: priceChange1hPct,
            price_change_24h_pct: priceChange24hPct,
            pair_url: pairUrl,
            trades_24h: totalTrades,
            buys_24h: buysCount,
            sells_24h: sellsCount,
            large_trades_24h: largeTrades24h,
            makers_24h: makers || null,
            measured_volume_24h_sol: measuredVolSol,
            net_flow_24h_sol: netFlowSol,
            recent_activity: activity.slice(-10).reverse()
        })
    };
};
