// src/App.tsx
// Verified Push: 2025-12-13 22:32
import React, { useEffect, useState } from "react";
import trailerVideo from "./assets/trailer.mp4";

type Summary = {
    mint: string;
    symbol: string;
    name: string;
    creator_wallet: string;
    donation_wallet: string;
    price_sol: number;
    market_cap_sol: number;
    curve_progress: number;
    total_fees_claimed_sol: number;
    total_donated_sol: number;
    mode: string;
    last_updated: string | null;
};

type Metrics = {
    price: { t: number; price_sol: number }[];
    market_cap: { t: number; market_cap_sol: number }[];
    fees_claimed_cumulative: { t: number; amount_sol: number }[];
    donations_cumulative: { t: number; amount_sol: number }[];
};

function formatSol(value: number): string {
    return `${value.toFixed(4)} SOL`;
}

function shorten(addr: string): string {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

const App: React.FC = () => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = async () => {
        try {
            const [sRes, mRes] = await Promise.all([
                fetch("/.netlify/functions/summary"),
                fetch("/.netlify/functions/metrics")
            ]);
            const sJson = await sRes.json();
            const mJson = await mRes.json();
            setSummary(sJson);
            setMetrics(mJson);
            setLoading(false);
        } catch (e) {
            console.error("Error fetching data:", e);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 10_000);
        return () => clearInterval(interval);
    }, []);



    if (loading && !summary) {
        return (
            <div className="app-root">
                <div className="card">
                    <div className="title">BadSeed Token Dashboard</div>
                    <div>Loading...</div>
                </div>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="app-root">
                <div className="card">
                    <div className="title">BadSeed Token Dashboard</div>
                    <div>Failed to load summary.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-root">
            <header className="header">
                <div>
                    <h1>
                        {summary.name} <span className="muted">({summary.symbol})</span>
                    </h1>
                    <div className="muted small">Mint: {shorten(summary.mint)}</div>
                </div>
                <div className="small right">
                    <div>Creator: {shorten(summary.creator_wallet)}</div>
                    <div>Donation: {shorten(summary.donation_wallet)}</div>
                    <div className="badge">{summary.mode === "raydium" ? "Raydium Phase" : "PumpSwap Phase"}</div>
                </div>
            </header>

            <section className="grid">
                <div className="card">
                    <div className="label">Price</div>
                    <div className="value">{formatSol(summary.price_sol)}</div>
                </div>
                <div className="card">
                    <div className="label">Market Cap</div>
                    <div className="value">{formatSol(summary.market_cap_sol)}</div>
                </div>
                <div className="card">
                    <div className="label">Creator Fees Claimed</div>
                    <div className="value">{formatSol(summary.total_fees_claimed_sol)}</div>
                </div>
                <div className="card">
                    <div className="label">Total Donated</div>
                    <div className="value">{formatSol(summary.total_donated_sol)}</div>
                </div>
            </section>

            <section className="card">
                <div className="label">Donation Progress</div>
                <DonationProgress donated={summary.total_donated_sol} goal={100} />
            </section>

            <section className="card">
                <div className="label">Curve Progress</div>
                <CurveProgress value={summary.curve_progress} />
            </section>

            <section className="card">
                <div className="label">Notes</div>
                <p className="small muted">
                    This dashboard tracks creator fees flowing from the BadSeed creator wallet to the donation wallet in near
                    real‑time. As trades occur on Pump.fun / PumpSwap, creator fees accumulate and are periodically forwarded as
                    donations.
                </p>
            </section>

            <section className="video-section">
                <video
                    className="video-player"
                    autoPlay
                    loop
                    muted
                    playsInline
                >
                    <source src={trailerVideo} type="video/mp4" />
                </video>
            </section>
        </div>
    );
};

const DonationProgress: React.FC<{ donated: number; goal: number }> = ({ donated, goal }) => {
    const pct = Math.min(100, (donated / goal) * 100);
    return (
        <div>
            <div className="small muted">
                {donated.toFixed(4)} / {goal} SOL
            </div>
            <div className="bar">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

const CurveProgress: React.FC<{ value: number }> = ({ value }) => {
    const pct = Math.max(0, Math.min(100, value * 100));
    return (
        <div>
            <div className="small muted">{pct.toFixed(1)}% towards Raydium migration</div>
            <div className="bar">
                <div className="bar-fill curve" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

export default App;
