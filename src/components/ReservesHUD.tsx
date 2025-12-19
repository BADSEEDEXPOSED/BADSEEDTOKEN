
import React from "react";
import { TokenSummary } from "../vite-env";

interface Props {
    data: TokenSummary | null;
}

export function ReservesHUD({ data }: Props) {
    if (!data) return null;

    // Format numbers: 1,000,000 -> 1.0M, 500,000 -> 500k
    const formatSupply = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
        if (num >= 1000) return (num / 1000).toFixed(1) + "k";
        return num.toString();
    };

    return (
        <div className="hud-container">
            <div className="hud-grid">
                {/* 1. Total Supply */}
                <div className="hud-item">
                    <span className="hud-label">TOTAL SUPPLY</span>
                    <span className="hud-value">{formatSupply(data.supply_total)}</span>
                </div>

                {/* 2. Community Held */}
                <div className="hud-item">
                    <span className="hud-label">COMMUNITY</span>
                    <span className="hud-value">{formatSupply(data.supply_community)}</span>
                </div>

                {/* 3. BadSeed / Donation */}
                <div className="hud-item">
                    <span className="hud-label">BADSEED / DONATION</span>
                    <span className="hud-value">
                        {formatSupply(data.supply_dev)} / {formatSupply(data.supply_donation)}
                    </span>
                </div>

                {/* 4. Burnt */}
                <div className="hud-item" style={{ borderColor: "rgba(255,50,50,0.3)" }}>
                    <span className="hud-label" style={{ color: "#ff6666" }}>BURNT 🔥</span>
                    <span className="hud-value" style={{ color: "#ffcfcf" }}>{formatSupply(data.supply_burn)}</span>
                    <span style={{ display: 'block', fontSize: '8px', opacity: 0.5, marginTop: '2px', fontFamily: 'monospace' }}>
                        1111...1111
                    </span>
                </div>
            </div>
        </div>
    );
}
