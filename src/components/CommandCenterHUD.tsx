import React from 'react';
import { BitQueryHUD } from './BitQueryHUD';

const SidePillar: React.FC<{
    title: string;
    children: React.ReactNode;
    align: 'left' | 'right';
    active: boolean;
}> = ({ title, children, align, active }) => (
    <div
        className={`side-pillar ${align} ${active ? 'active' : ''}`}
        style={{
            // Keep specific positioning inline or let CSS handle via classes .left/.right? 
            // CSS classes are better for responsive overrides.
            // I'll define .side-pillar.left and .side-pillar.right in CSS.
        }}
    >
        <div className="label small muted" style={{
            textTransform: 'uppercase',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '8px',
            marginBottom: '4px',
            letterSpacing: '1px',
            fontSize: '10px',
            textAlign: 'center'
        }}>
            {title}
        </div>

        {/* Content Container */}
        <div className="pillar-content" style={{
            flex: 1,
            display: 'flex',
            // flexDirection handled in CSS for responsive layout
            gap: '12px'
        }}>
            {children}
        </div>
    </div>
);

const StatRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#fff' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '8px' }}>
        <span className="small muted" style={{ fontSize: '9px' }}>{label}</span>
        <span style={{ fontWeight: 600, color, fontFamily: 'monospace', fontSize: '11px' }}>{value}</span>
    </div>
);

export const CommandCenterHUD: React.FC<{ recentActivity?: string[]; mode?: string }> = ({ recentActivity, mode }) => {
    // Logic: Always "Active" if we have activity, or if mode is appropriate.
    // User wants "Real Data now".
    const hasData = recentActivity && recentActivity.length > 0;
    const isActive = true; // Always show frame as active/armed per request "not dark/blurred"

    // Parse recentActivity for Volume/Counts
    let buyCount = 0;
    let sellCount = 0;

    if (recentActivity) {
        recentActivity.forEach(msg => {
            if (msg.includes("Buy") || msg.includes("🟢") || msg.includes("🐳")) buyCount++;
            if (msg.includes("Sell") || msg.includes("🔴") || msg.includes("🦈")) sellCount++;
        });
    }

    const totalOrders = buyCount + sellCount;
    const buyPct = totalOrders > 0 ? Math.round((buyCount / totalOrders) * 100) : 50; // Default to 50 if no data
    const sellPct = totalOrders > 0 ? 100 - buyPct : 50;

    // Safely extract last amount to avoid Type Error
    let lastAmt = "---";
    if (recentActivity && recentActivity.length > 0) {
        const parts = recentActivity[0].split(':');
        if (parts.length > 1) {
            lastAmt = parts[1].trim();
        }
    }

    const txCount = recentActivity?.length || 0;

    return (
        <>
            {/* Left Pillar: Market Stats */}
            <SidePillar title="Telemetry" align="left" active={isActive}>
                {/* We don't have Pump.fun volume yet, so keep these as placeholders or hook up to summary logic later */}
                <StatRow label="24h Volume" value="---" color="#86efac" />
                <StatRow label="Liquidity" value="---" color="#60a5fa" />
                <StatRow label="FDV" value="---" />
                <StatRow label="Mkt Cap" value="---" />

                <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div className="small muted" style={{ marginBottom: '4px', fontSize: '9px' }}>Trend (24h)</div>
                    <div style={{ height: '4px', width: '100%', background: '#333', borderRadius: '2px' }}>
                        {/* Flat line for now */}
                    </div>
                </div>
            </SidePillar>

            {/* Center: The Main BitQuery HUD - Active Always (Armed) */}
            <BitQueryHUD recentActivity={recentActivity} style={{ width: '480px', maxWidth: '100%' }} />

            {/* Right Pillar: Trader Analysis */}
            <SidePillar title="Order Flow" align="right" active={isActive}>
                {/* Show simplified Order Flow */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="small" style={{ color: '#4ade80', fontSize: '9px' }}>B: {hasData ? buyPct : "--"}%</span>
                    <span className="small" style={{ color: '#f87171', fontSize: '9px' }}>S: {hasData ? sellPct : "--"}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden', display: 'flex', marginBottom: '12px' }}>
                    <div style={{ width: `${buyPct}%`, background: '#4ade80', transition: 'width 0.5s ease' }}></div>
                    <div style={{ width: `${sellPct}%`, background: '#f87171', transition: 'width 0.5s ease' }}></div>
                </div>

                <StatRow label="Tx Count" value={txCount.toString()} color="#fff" />
                <StatRow label="Last Amt" value={lastAmt} color="#fff" />
                <StatRow label="Makers" value="---" />

                <div style={{ marginTop: 'auto', textAlign: 'right' }}>
                    <span className="small muted" style={{ fontSize: '8px' }}>REAL-TIME STREAM</span>
                </div>
            </SidePillar>
        </>
    );
};
