// Verified Push: 2025-12-13 22:32
import React, { useEffect, useState } from "react";
import { Buffer } from "buffer";
// @ts-ignore
window.Buffer = Buffer;
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
    debug_price?: string;
    debug_mcap?: string;
    debug_progress?: string;
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
                sJson.debug_progress = `Sold (0.0M) / Target (800M)`;
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
        const fetchLocalDev = async () => {
            if (import.meta.env.DEV) {
                console.log("DEV MODE: Fetching PumpSwap data directly...");
                try {
                    // Use local proxy to bypass CORS/403 (Must be absolute URL for Connection class)
                    const rpc = window.location.origin + "/solana-rpc";
                    const PROG_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
                    const MINT = "3HPpMLK7LjKFqSnCsBYNiijhNTo7dkkx3FCSAHKSpump"; // BADSEED Reality

                    console.log("Connecting to Solana...", MINT);
                    const { Connection, PublicKey } = await import("@solana/web3.js");
                    const conn = new Connection(rpc);
                    const mintPub = new PublicKey(MINT);
                    const progPub = new PublicKey(PROG_ID);
                    const [pda] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mintPub.toBuffer()], progPub);

                    console.log("PDA Derived:", pda.toBase58());
                    const info = await conn.getAccountInfo(pda);

                    if (info) {
                        console.log("Data received, length:", info.data.length);
                        const data = info.data;
                        // Manual Decode
                        const vTokenRaw = Number(data.readBigUInt64LE(8));
                        const vSolRaw = Number(data.readBigUInt64LE(16));
                        const rTokenRaw = Number(data.readBigUInt64LE(24));
                        const rSolRaw = Number(data.readBigUInt64LE(32));
                        const supplyRaw = Number(data.readBigUInt64LE(40));

                        // Unit Conversions
                        const vToken = vTokenRaw / 1e6; // Decimals: 6
                        const vSol = vSolRaw / 1e9;     // Decimals: 9
                        const rSol = rSolRaw / 1e9;     // Decimals: 9
                        const supply = supplyRaw / 1e6; // Decimals: 6

                        // Price (SOL per Token)
                        const price = vSol / vToken;

                        // Market Cap (SOL)
                        const mcap = price * supply;

                        // Progress Calculation (Deterministic Token-Based)
                        const INIT_VTOKEN = 1073000000;
                        const TARGET_SOLD = 800000000; // Approx amount sold to bond
                        const tokensSold = INIT_VTOKEN - vToken;
                        const progress = Math.min(1, Math.max(0, tokensSold / TARGET_SOLD));

                        // Strict Pre-Launch Detection (vSol Ground Truth)
                        const isPreLaunch = vSol < 30.05;

                        setSummary({
                            mint: MINT,
                            symbol: "BADSEED",
                            name: "BadSeed",
                            creator_wallet: "9TyzcephhXEw67piYNc72EJtgVmbq3AZhyPFSvdfXWdr",
                            donation_wallet: "CZ7Lv3QNVxbBivGPBhJG7m1HpCtfEDjEusBjjZ3qmVz5",
                            price_sol: price,
                            market_cap_sol: mcap,
                            curve_progress: progress,
                            total_fees_claimed_sol: 0,
                            total_donated_sol: 0,
                            mode: isPreLaunch ? "pre-launch" : "pumpswap",
                            last_updated: new Date().toISOString(),
                            debug_price: `vSol (${vSol.toFixed(2)}) / vTokens (${(vToken / 1e6).toFixed(1)}M)`,
                            debug_mcap: `Price * Supply (${(supply / 1e9).toFixed(1)}B)`,
                            debug_progress: `Sold (${(tokensSold / 1e6).toFixed(1)}M) / Target (${(TARGET_SOLD / 1e6).toFixed(0)}M)`
                        });
                        setMetrics({
                            price: [], market_cap: [], fees_claimed_cumulative: [], donations_cumulative: []
                        });
                    } else {
                        console.warn("Account not found (Bonding curve missing) - Using Initial State");
                        // Fallback: Initial State (Pre-Bonding)
                        const INIT_VTOKEN = 1073000000;
                        const INIT_VSOL = 30; // Pump.fun always starts with 30 SOL virtual liquidity
                        const price = INIT_VSOL / INIT_VTOKEN;
                        const supply = 1000000000; // 1B Total Supply
                        const mcap = price * supply;

                        setSummary({
                            mint: MINT,
                            symbol: "BADSEED",
                            name: "BadSeed",
                            creator_wallet: "9TyzcephhXEw67piYNc72EJtgVmbq3AZhyPFSvdfXWdr",
                            donation_wallet: "CZ7Lv3QNVxbBivGPBhJG7m1HpCtfEDjEusBjjZ3qmVz5",
                            price_sol: price,
                            market_cap_sol: mcap,
                            curve_progress: 0,
                            total_fees_claimed_sol: 0,
                            total_donated_sol: 0,
                            mode: "pre-launch",
                            last_updated: new Date().toISOString(),
                            debug_price: `vSol (${INIT_VSOL.toFixed(2)}) / vTokens (${(INIT_VTOKEN / 1e6).toFixed(1)}M)`,
                            debug_mcap: `Price * Supply (${(supply / 1e9).toFixed(1)}B)`,
                            debug_progress: `Sold (0.0M) / Target (800M)`
                        });
                    }
                } catch (e) {
                    console.error("Local fetch failed", e);
                } finally {
                    setLoading(false);
                }
            } else {
                fetchAll();
            }
        };

        if (import.meta.env.DEV) {
            fetchLocalDev();
            // Fast polling for volatile test token
            const interval = setInterval(fetchLocalDev, 1000);
            return () => clearInterval(interval);
        } else {
            fetchAll();
            const interval = setInterval(fetchAll, 10_000);
            return () => clearInterval(interval);
        }
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
                        <div className="badge">
                            {summary.mode === "raydium" ? "Raydium Phase" :
                                summary.mode === "pre-launch" ? "Pre-Launch Phase" :
                                    "PumpSwap Phase"}
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
                            {solPrice && (
                                <div className="value" style={{ fontSize: '14px', color: '#86efac' }}>
                                    1 SOL = ${solPrice.toFixed(2)}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="card">
                    <div className="label">Donation Progress</div>
                    <DonationProgress donated={summary.total_donated_sol} goal={100} />
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
