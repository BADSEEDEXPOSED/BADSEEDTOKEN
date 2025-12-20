import React, { useEffect, useState } from 'react';

type Candle = {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
};

// Simple SVG Sparkline with Placeholder Support
const Sparkline: React.FC<{ data: Candle[] }> = ({ data }) => {
    const width = 300;
    const height = 60;
    const isEmpty = !data || data.length === 0;

    // Placeholder Data: A flat line or subtle pulse
    const renderData = isEmpty
        ? Array.from({ length: 24 }, (_, i) => ({ c: 50 + Math.sin(i) * 2 })) // Subtle wave
        : data;

    // Find min/max for scaling
    const prices = renderData.map(d => d.c);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // Create Path
    const points = renderData.map((d, i) => {
        const x = (i / (renderData.length - 1)) * width;
        const y = height - ((d.c - min) / range) * height; // Scale to fit
        return `${x},${y}`;
    }).join(' ');

    const trendColor = isEmpty ? '#333' : (renderData[renderData.length - 1].c >= renderData[0].c) ? '#4ade80' : '#f87171';
    const strokeWidth = isEmpty ? "1" : "2";

    return (
        <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
            {isEmpty && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#444', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase'
                }}>
                    Awaiting Market Data
                </div>
            )}
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                {/* Background Grid Lines for Placeholder Feeling */}
                {isEmpty && (
                    <>
                        <line x1="0" y1="20" x2="300" y2="20" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="40" x2="300" y2="40" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                    </>
                )}
                <path d={`M ${points}`} fill="none" stroke={trendColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" strokeDasharray={isEmpty ? "4 4" : ""} />
            </svg>
            {!isEmpty && (
                <div className="spark-info" style={{
                    position: 'absolute', top: 0, right: 0,
                    color: trendColor, fontSize: '10px', fontWeight: 'bold'
                }}>
                    24H
                </div>
            )}
        </div>
    );
};

// Ticker Component handling Real vs Standby phases
const Ticker: React.FC<{ items?: string[] }> = ({ items }) => {
    const [msg, setMsg] = useState("Initializing Feed...");

    useEffect(() => {
        // If we have real items, cycle them.
        // If not (Pre-Launch), show system status.
        const pool = (items && items.length > 0)
            ? items
            : ["System Armed", "Waiting for Launch Activity...", "Listening to Helius Stream"];

        let idx = 0;
        setMsg(pool[0]);

        const interval = setInterval(() => {
            idx = (idx + 1) % pool.length;
            setMsg(pool[idx]);
        }, 3000);

        return () => clearInterval(interval);
    }, [items]);

    return <div className="small fade-text in" style={{ minHeight: '20px' }}>{msg}</div>;
};

export const BitQueryHUD: React.FC<{ recentActivity?: string[]; style?: React.CSSProperties }> = ({ recentActivity, style }) => {
    const [chartData, setChartData] = useState<Candle[]>([]);
    // Default loading to TRUE, but we render Placeholder if loading is done and data is empty.
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch('/.netlify/functions/bitquery-poller');
            if (res.status === 404) throw new Error("Local Dev - Function not found");
            const json = await res.json();
            if (json.ok && json.chart && json.chart.length > 0) {
                setChartData(json.chart);
            } else {
                setChartData([]); // Explicitly empty
            }
        } catch (e) {
            console.warn("API Error or Pre-Launch:", e);
            setChartData([]); // Reset to empty on error (Placeholder Mode)
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const defaultStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '600px',
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '3px',
        padding: '12px 20px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
        zIndex: 20
    };

    return (
        <div className="hud-panel bitquery-panel" style={{ ...defaultStyle, ...style }}>
            <div style={{ flex: 1 }}>
                <div className="label small muted" style={{ marginBottom: '8px' }}>MARKET TELEMETRY (24H)</div>
                {/* Always render Sparkline now, it handles the Empty/Loading state internally */}
                <Sparkline data={chartData} />
            </div>

            <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>

            <div style={{ flex: 1 }}>
                <div className="label small muted">LIVE FEED</div>
                <div className="small" style={{ color: '#86efac', marginTop: '4px' }}>
                    ● System Online
                </div>
                <div className="small muted" style={{ fontSize: '10px' }}>
                    <Ticker items={recentActivity} />
                </div>
            </div>
        </div>
    );
};
