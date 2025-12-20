import React, { useEffect, useState } from 'react';

type Candle = {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
};

// Simple SVG Sparkline
const Sparkline: React.FC<{ data: Candle[] }> = ({ data }) => {
    if (!data || data.length === 0) return <div className="muted small">Waiting for market data...</div>;

    const width = 300;
    const height = 60;

    // Find min/max for scaling
    const prices = data.map(d => d.c);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // Create Path
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.c - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const trendColor = (data[data.length - 1].c >= data[0].c) ? '#4ade80' : '#f87171';

    return (
        <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <path d={`M ${points}`} fill="none" stroke={trendColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="spark-info" style={{
                position: 'absolute', top: 0, right: 0,
                color: trendColor, fontSize: '10px', fontWeight: 'bold'
            }}>
                24H
            </div>
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

export const BitQueryHUD: React.FC<{ recentActivity?: string[] }> = ({ recentActivity }) => {
    const [chartData, setChartData] = useState<Candle[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch('/.netlify/functions/bitquery-poller');
            if (res.status === 404) throw new Error("Local Dev - Function not found");
            const json = await res.json();
            if (json.ok && json.chart) {
                setChartData(json.chart);
                setLoading(false);
            }
        } catch (e) {
            console.warn("Using Demo Data (Dev Mode active or API not ready)");
            // Keep Demo Chart for visuals if real API fails (or pre-launch)
            // But Ticker is now controlled by props.
            const mock = Array.from({ length: 24 }, (_, i) => ({
                t: i.toString(),
                o: 10 + i, h: 12 + i, l: 9 + i, c: 10 + i + (Math.random() * 5 - 2), v: 100
            }));
            setChartData(mock);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="hud-panel bitquery-panel" style={{
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
        }}>
            <div style={{ flex: 1 }}>
                <div className="label small muted" style={{ marginBottom: '8px' }}>MARKET TELEMETRY (24H)</div>
                {loading ? (
                    <div className="small muted">Initializing Satellite Link...</div>
                ) : (
                    <Sparkline data={chartData} />
                )}
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
