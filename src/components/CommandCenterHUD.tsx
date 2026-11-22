import React from "react";
import { BitQueryHUD } from "./BitQueryHUD";

export type Activity = { signature: string; timestamp: number; side: "buy" | "sell"; token_amount: number; sol_amount: number | null; maker: string; tier: "standard" | "large" };
export type MarketSnapshot = {
    status: "awaiting-launch" | "live" | "delayed";
    provider: string;
    measured_at: string;
    price_usd: number | null;
    liquidity_usd: number | null;
    fdv_usd: number | null;
    market_cap_usd: number | null;
    volume_24h_usd: number | null;
    price_change_1h_pct?: number | null;
    price_change_24h_pct: number | null;
    trades_24h: number;
    buys_24h: number;
    sells_24h: number;
    large_trades_24h?: number;
    makers_24h: number | null;
    measured_volume_24h_sol: number | null;
    net_flow_24h_sol?: number | null;
    pair_url?: string | null;
    dex_paid?: boolean;
    dex_boosts?: number;
    recent_activity: Activity[];
};

const formatUsd = (value: number | null) =>
    value == null
        ? "WAITING"
        : new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: value >= 10000 ? "compact" : "standard",
              maximumFractionDigits: value < 0.01 ? 6 : value < 1 ? 4 : 1,
          }).format(value);

const formatPct = (value: number | null | undefined) =>
    value == null ? "WAITING" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

const SidePillar: React.FC<{ title: string; children: React.ReactNode; align: "left" | "right"; active: boolean }> = ({ title, children, align, active }) => (
    <div className={`side-pillar ${align} ${active ? "active" : "standby"}`}>
        <div className="label pillar-title">{title}</div>
        <div className="pillar-content">{children}</div>
    </div>
);

const StatRow: React.FC<{ label: string; value: string; tone?: "rise" | "fall" | "neutral" }> = ({ label, value, tone = "neutral" }) => (
    <div className="telemetry-row">
        <span>{label}</span>
        <strong className={tone}>{value}</strong>
    </div>
);

export const CommandCenterHUD: React.FC<{ market: MarketSnapshot | null; mode?: string; stale?: boolean }> = ({ market, mode, stale }) => {
    const active = mode !== "pre-launch" && market?.status === "live" && !stale;
    const buys = market?.buys_24h || 0;
    const sells = market?.sells_24h || 0;
    const total = buys + sells;
    const buyPct = total ? Math.round((buys / total) * 100) : null;
    const sellPct = buyPct == null ? null : 100 - buyPct;
    const trend1h = market?.price_change_1h_pct ?? null;
    const trend24h = market?.price_change_24h_pct ?? null;
    const netFlow = market?.net_flow_24h_sol ?? null;
    const whales = market?.large_trades_24h ?? 0;
    const recent = market?.recent_activity || [];
    const latest = recent[0];
    const feed = recent.map(item => `${item.tier === "large" ? "LARGE " : ""}${item.side.toUpperCase()}  ${item.token_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} BADSEED`);

    return (
        <div className="command-center-hud">
            <SidePillar title="Market Signal" align="left" active={active}>
                <StatRow label="Price (USD)" value={formatUsd(market?.price_usd ?? null)} />
                <StatRow label="Market Cap" value={formatUsd(market?.market_cap_usd ?? null)} />
                <StatRow label="Liquidity" value={formatUsd(market?.liquidity_usd ?? null)} />
                <StatRow label="24H Volume" value={formatUsd(market?.volume_24h_usd ?? null)} />
                <StatRow label="1H Change" value={formatPct(trend1h)} tone={trend1h == null ? "neutral" : trend1h >= 0 ? "rise" : "fall"} />
                <StatRow label="24H Change" value={formatPct(trend24h)} tone={trend24h == null ? "neutral" : trend24h >= 0 ? "rise" : "fall"} />
            </SidePillar>

            <BitQueryHUD recentActivity={feed} status={market?.status || "awaiting-launch"} style={{ width: "480px", maxWidth: "100%" }} />

            <SidePillar title="Order Flow" align="right" active={active}>
                <div className="flow-readout">
                    <span>B {buyPct == null ? "--" : buyPct}%</span>
                    <span>S {sellPct == null ? "--" : sellPct}%</span>
                </div>
                <div className="flow-track" aria-label={buyPct == null ? "Order flow awaiting trades" : `${buyPct}% buys and ${sellPct}% sells`}>
                    {buyPct != null && (
                        <>
                            <i className="flow-buy" style={{ width: `${buyPct}%` }} />
                            <i className="flow-sell" style={{ width: `${sellPct}%` }} />
                        </>
                    )}
                </div>
                <div className="flow-counts">B {buys} · S {sells}</div>
                <StatRow label="Trades / 24H" value={market ? String(market.trades_24h) : "WAITING"} />
                <StatRow label="Makers / 24H" value={market?.makers_24h == null ? "WAITING" : String(market.makers_24h)} />
                <StatRow
                    label="Net Flow"
                    value={netFlow == null ? "WAITING" : `${netFlow > 0 ? "+" : ""}${netFlow.toFixed(2)} SOL`}
                    tone={netFlow == null ? "neutral" : netFlow >= 0 ? "rise" : "fall"}
                />
                <StatRow label="Whales (>1M)" value={String(whales)} tone={whales > 0 ? "rise" : "neutral"} />
                <StatRow
                    label="Latest"
                    value={latest ? `${latest.side.toUpperCase()} ${latest.token_amount.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })}` : "WAITING"}
                    tone={latest ? (latest.side === "buy" ? "rise" : "fall") : "neutral"}
                />
                <div className="stream-source">
                    {market?.provider === "dexscreener" ? "MARKET INDEX + CHAIN STREAM" : mode === "pre-launch" ? "ARMED FOR LAUNCH" : "CHAIN STREAM"}
                </div>
            </SidePillar>
        </div>
    );
};
