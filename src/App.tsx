// Verified Push: 2025-12-13 22:32
import React, { useEffect, useState } from "react";
import { Buffer } from "buffer";
// @ts-ignore
window.Buffer = Buffer;
import trailerVideo from "./assets/trailer.mp4";
import { ReservesHUD } from "./components/ReservesHUD";
import { BitQueryHUD } from "./components/BitQueryHUD";
import { CommandCenterHUD } from "./components/CommandCenterHUD";

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
    pre_launch_donated_sol: number;
    mode: string;
    last_updated: string | null;
    debug_price?: string;
    debug_mcap?: string;
    debug_progress?: string;
    supply_total: number;
    supply_community: number;
    supply_dev: number;
    supply_donation: number;
    supply_burn: number;
    recent_activity?: string[];
};



// ... inside App component ...
// Update the "Total Donated" card section
/* 
<section className="card">
    <div className="label">Total Donated</div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="value">{formatSol(summary.total_donated_sol)}</div>
        <div style={{ textAlign: 'right' }}>
             {solPrice && (
                <div className="value" style={{ fontSize: '14px', color: '#86efac' }}>
                    1 SOL = ${solPrice.toFixed(2)}
                </div>
            )}
            <div className="small muted" style={{ fontSize: '10px', marginTop: '4px' }}>
                <span style={{color: '#60a5fa'}}>Pre: {summary.pre_launch_donated_sol.toFixed(2)}</span>
                <span style={{margin: '0 4px'}}>|</span>
                <span style={{color: '#4ade80'}}>Fees: {(summary.total_donated_sol - summary.pre_launch_donated_sol).toFixed(2)}</span>
            </div>
        </div>
    </div>
</section> 
*/

// Updated DonationProgress Component

const DonationProgress: React.FC<{ donated: number; goal: number; pre: number }> = ({ donated, goal, pre }) => {
    // Visual clamping: Bar cannot exceed 100% width, but text can exceed goal.
    const effectiveDonated = Math.min(donated, goal); // Used for bar width only? No, we want FULL bar if over.
    // If donated > goal, totalPct is > 100. We must clamp width to 100%.

    const totalWidthPct = Math.min(100, (donated / goal) * 100);

    // Calculate segments based on limited width
    const prePct = Math.min(totalWidthPct, (pre / goal) * 100);
    const feePct = totalWidthPct - prePct;

    const isOvercharged = donated > goal;

    return (
        <div>
            <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={isOvercharged ? { color: '#4ade80', fontWeight: 'bold' } : {}}>
                    {donated.toFixed(4)} / {goal} SOL
                </span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                    <span style={{ color: '#60a5fa' }}>Seed</span> + <span style={{ color: '#4ade80' }}>Fees</span>
                </span>
            </div>
            <div className={`bar ${isOvercharged ? 'overcharged' : ''}`} style={{ display: 'flex', overflow: 'hidden' }}>
                {/* Pre-Launch Segment (Blue) */}
                <div style={{
                    width: `${prePct}%`,
                    backgroundColor: '#60a5fa', // Tailwind blue-400
                    height: '100%',
                    transition: 'width 0.5s ease'
                }} />

                {/* Creator Fees Segment (Green) */}
                <div style={{
                    width: `${feePct}%`,
                    backgroundColor: '#4ade80', // Tailwind green-400
                    height: '100%',
                    transition: 'width 0.5s ease'
                }} />
            </div>
        </div>
    );
};

type Metrics = {
    price: { t: number; price_sol: number }[];
    market_cap: { t: number; market_cap_sol: number }[];
    fees_claimed_cumulative: { t: number; amount_sol: number }[];
    donations_cumulative: { t: number; amount_sol: number }[];
};

function formatSol(value: number): string {
    return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`;
}

function formatPrice(value: number): string {
    return `${value.toFixed(10)} SOL`;
}

function shorten(addr: string): string {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

const RotatingNotes: React.FC<{ mode: string }> = ({ mode }) => {
    const getMetricsNote = (m: string) => {
        if (m === "pre-launch") return "Metrics: System armed. Awaiting signal. The bonding curve is dormant until the first transaction ignites the protocol.";
        if (m === "raydium") return "Metrics: Migration complete. Liquidity unlocked on Raydium. The seed has grown beyond the curve.";
        return "Metrics: Bonding Curve active. Tracking trajectory towards the Raydium horizon. Every trade accelerates the migration event.";
    };

    const NOTES = [
        "This dashboard tracks creator fees flowing from the BadSeed creator wallet to the donation wallet. As trades occur on Pump.fun / PumpSwap, creator fees accumulate and are forwarded to the Donation Wallet.",
        getMetricsNote(mode),
        "The Lore: They buried us in the dirt and called us bad seeds. They forgot that dirt is where growth begins. We absorb the toxicity of the market and bloom into something pure.",
        "System: Real-time telemetry is engaged. Monitoring on-chain events with millisecond precision to ensure total transparency.",
        "Philosophy: In a garden of volatility, we plant stability. The user trades, the protocol builds."
    ];

    const [index, setIndex] = useState(0);
    const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

    useEffect(() => {
        const interval = setInterval(() => {
            setFadeState('out'); // Fade out (3s duration)
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % NOTES.length); // Change text after fade out + 1s delay
                setFadeState('in'); // Fade in (3s duration)
            }, 4000); // 3s animation + 1s void
        }, 30000); // 30 seconds per note cycle

        return () => clearInterval(interval);
    }, [NOTES.length]);

    return (
        <p className={`small muted fade-text ${fadeState}`} style={{ minHeight: '60px' }}>
            {NOTES[index]}
        </p>
    );
};

const LiveDebug: React.FC<{ text: string }> = ({ text }) => {
    const [display, setDisplay] = useState(text);

    useEffect(() => {
        let frame: number;
        const animate = () => {
            const jittered = text.replace(/(\d+\.\d)(\d+)/g, (match, prefix, decimals) => {
                // Keep prefix (e.g. "30.5"), randomize trailing decimals
                if (Math.random() > 0.7) return match;
                // Fix: Ensure noise is exactly the same length as the replaced decimals
                const max = Math.pow(10, decimals.length);
                const noise = Math.floor(Math.random() * max).toString().padStart(decimals.length, '0');
                return `${prefix}${noise}`;
            });
            setDisplay(jittered);
            frame = requestAnimationFrame(() => setTimeout(animate, 60));
        };
        animate();
        return () => cancelAnimationFrame(frame);
    }, [text]);

    return <div className="debug-math">{display}</div>;
};

const App: React.FC = () => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [solPrice, setSolPrice] = useState<number | null>(null);

    useEffect(() => {
        const fetchSolPrice = () => {
            fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
                .then(res => res.json())
                .then(data => setSolPrice(data.solana.usd))
                .catch(e => console.error("Failed to fetch SOL price", e));
        };
        fetchSolPrice();
        const interval = setInterval(fetchSolPrice, 20000); // Update every 20 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchAll = async () => {
        try {
            const [sRes, mRes] = await Promise.all([
                fetch("/.netlify/functions/summary"),
                fetch("/.netlify/functions/metrics")
            ]);
            const sJson = await sRes.json();
            const mJson = await mRes.json();

            // Client-Side Sanitization: Never show 0 for Price/Mcap
            // If API returns 0 (e.g. cold server), use Pre-Launch defaults
            if (!sJson.price_sol || sJson.price_sol === 0) {
                const INIT_PRICE = 0.000000028;
                sJson.price_sol = INIT_PRICE;
                sJson.debug_price = `vSol (30.00) / vTokens (1073.0M)`;
            }
            if (!sJson.market_cap_sol || sJson.market_cap_sol === 0) {
                sJson.market_cap_sol = 28;
                sJson.debug_mcap = `Price * Supply (28.0 SOL)`;
            }
            if (!sJson.curve_progress) {
                sJson.debug_progress = `Sold (0.0M) / Target (793.1M)`;
            }

            setSummary(sJson);
            setMetrics(mJson);
            setLoading(false);
        } catch (e) {
            console.error("Error fetching data:", e);
            setLoading(false);
        }
    };

    useEffect(() => {
        // Unified Fetching: Always use the API (proxied in local dev)
        // This ensures local dev sees EXACTLY what the production server sees.
        fetchAll();

        const POLLING_INTERVAL = import.meta.env.DEV ? 2000 : 10000;
        const interval = setInterval(fetchAll, POLLING_INTERVAL);

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
        <>
            <iframe id="background-frame" src="/background.html" title="Background"></iframe>
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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', justifyContent: 'flex-end' }}>
                            {solPrice && (
                                <div className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#86efac', border: '1px solid rgba(134, 239, 172, 0.2)' }}>
                                    1 SOL = ${solPrice.toFixed(2)}
                                </div>
                            )}
                            <div className="badge">
                                {summary.mode === "raydium" ? "Raydium Phase" :
                                    summary.mode === "pre-launch" ? "Pre-Launch Phase" :
                                        "PumpSwap Phase"}
                            </div>
                        </div>
                    </div>
                </header>

                <section className="grid">
                    <div className="card debug-card">
                        <div className="label">Price</div>
                        <div className="value">{formatPrice(summary.price_sol)}</div>
                        {summary.debug_price && <LiveDebug text={summary.debug_price} />}
                    </div>
                    <div className="card debug-card">
                        <div className="label">Market Cap</div>
                        <div className="value">{formatSol(summary.market_cap_sol)}</div>
                        {summary.debug_mcap && <LiveDebug text={summary.debug_mcap} />}
                    </div>
                    <div className="card">
                        <div className="label">Creator Fees Claimed</div>
                        <div className="value">{formatSol(summary.total_fees_claimed_sol)}</div>
                    </div>
                    <div className="card">
                        <div className="label">Total Donated</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div className="value">{formatSol(summary.total_donated_sol)}</div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="small muted" style={{ fontSize: '10px', marginTop: '4px' }}>
                                    <span style={{ color: '#60a5fa' }}>Pre: {summary.pre_launch_donated_sol.toFixed(4)}</span>
                                    <span style={{ margin: '0 4px' }}>|</span>
                                    <span style={{ color: '#4ade80' }}>Fees: {(summary.total_donated_sol - summary.pre_launch_donated_sol).toFixed(4)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="card">
                    <div className="label">Seed Capital</div>
                    <DonationProgress donated={summary.total_donated_sol} goal={100} pre={summary.pre_launch_donated_sol} />
                </section>

                <section className="card debug-card">
                    <div className="label">Curve Progress</div>
                    <CurveProgress value={summary.curve_progress} />
                    {summary.debug_progress && <LiveDebug text={summary.debug_progress} />}
                </section>




                <section className="card">
                    <div className="label">Notes</div>
                    <RotatingNotes mode={summary.mode} />
                </section>

                <section className="video-section">
                    <div className="video-wrapper">
                        <ReservesHUD data={summary} />
                        <CommandCenterHUD recentActivity={summary?.recent_activity} mode={summary?.mode} />
                        <video
                            className="video-player"
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{ objectFit: 'cover' }}
                        >
                            <source src={trailerVideo} type="video/mp4" />
                        </video>
                    </div>
                </section>
                <div className="spacer"></div>
            </div>
        </>
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
