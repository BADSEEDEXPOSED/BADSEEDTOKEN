import React, { useEffect, useState } from 'react';
import './GodMode.css';

// Intefaces
interface TokenSummary {
    price_sol: number;
    market_cap_sol: number;
    total_donated_sol: number;
    supply_burn: number;
    debug_price: string;
}

interface ProphecyData {
    text: string;
    date: string;
    ready: boolean;
    stats?: any; // If exposed
}

export const GodMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [tokenData, setTokenData] = useState<TokenSummary | null>(null);
    const [prophecy, setProphecy] = useState<ProphecyData | null>(null);
    const [voiceStatus, setVoiceStatus] = useState<string>('CONNECTING...');
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchData = async () => {
        try {
            // 1. Fetch Local Token Summary
            const summaryRes = await fetch('/.netlify/functions/summary');
            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setTokenData(data);
            }

            // 2. Fetch Remote Prophecy (Assuming Port 8888 for Local Dev)
            // In Production, this URL needs to be the real badseed-exposed domain.
            // For now, we try localhost:8888 first, or fallback to current origin if proxied.
            const voiceUrl = window.location.hostname === 'localhost'
                ? 'http://localhost:8888/.netlify/functions/prophecy-get'
                : 'https://badseed-exposed.netlify.app/.netlify/functions/prophecy-get'; // Fallback

            try {
                const propRes = await fetch(voiceUrl);
                if (propRes.ok) {
                    const pData = await propRes.json();
                    setProphecy(pData);
                    setVoiceStatus('ONLINE');
                } else {
                    setVoiceStatus('ERROR ' + propRes.status);
                }
            } catch (e) {
                setVoiceStatus('OFFLINE (Check Port 8888)');
            }

            setLastUpdated(new Date().toLocaleTimeString());

        } catch (e) {
            console.error("God Mode Fetch Error", e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="god-mode-overlay">
            <div className="god-mode-terminal">
                <div className="god-header">
                    <span>⚡ ANTIGRAVITY LINK ESTABLISHED</span>
                    <button onClick={onClose} className="god-close">[DISCONNECT]</button>
                </div>

                <div className="god-grid">
                    {/* LEFT: VALUE NODE (Token) */}
                    <div className="god-panel value-node">
                        <h3>[NODE: VALUE]</h3>
                        <div className="god-stat">
                            <label>PRICE:</label>
                            <span>{tokenData?.price_sol?.toFixed(9) || '---'} SOL</span>
                        </div>
                        <div className="god-stat">
                            <label>MCAP:</label>
                            <span>{tokenData?.market_cap_sol?.toFixed(2) || '---'} SOL</span>
                        </div>
                        <div className="god-stat">
                            <label>SACRIFICED:</label>
                            <span>{tokenData?.total_donated_sol?.toFixed(2) || '---'} SOL</span>
                        </div>
                        <div className="god-stat">
                            <label>BURNT:</label>
                            <span>{tokenData?.supply_burn?.toLocaleString() || '---'} BAD</span>
                        </div>
                        <div className="god-raw">
                            {tokenData?.debug_price}
                        </div>
                    </div>

                    {/* RIGHT: VOICE NODE (Exposed) */}
                    <div className="god-panel voice-node">
                        <h3>[NODE: VOICE] <span className={voiceStatus === 'ONLINE' ? 'status-ok' : 'status-err'}>{voiceStatus}</span></h3>

                        <div className="god-prophecy">
                            <label>LATEST TRANSMISSION:</label>
                            <p>"{prophecy?.text || 'SILENCE...'}"</p>
                        </div>

                        <div className="god-stat">
                            <label>DATE:</label>
                            <span>{prophecy?.date || '---'}</span>
                        </div>
                        <div className="god-stat">
                            <label>STATUS:</label>
                            <span>{prophecy?.ready ? 'READY' : 'PENDING'}</span>
                        </div>
                    </div>
                </div>

                <div className="god-footer">
                    <span>SYNC: {lastUpdated}</span>
                    <span>BRAIN: WAITING FOR INSTRUCTION...</span>
                </div>
            </div>
        </div>
    );
};
