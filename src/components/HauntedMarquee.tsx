import React, { useState, useEffect } from 'react';

const PRE_LAUNCH_PHRASES = [
    "Nothing has moved. The record is still becoming.",
    "The first mark has not been made. The surface is listening.",
    "A public address waits. Attention gathers around an unopened event.",
    "The numbers are quiet. The apparatus is awake.",
    "Before movement, there is only the shape movement will leave behind.",
    "The seed is visible. Its consequence is not.",
    "No signal has arrived. The receiver remains on.",
    "What begins here will remain legible after the moment passes.",
    "The ledger does not anticipate. It remembers.",
    "Visibility comes first. Meaning follows the trace.",
    "The field is empty enough to show the first footprint.",
    "When the number changes, the story becomes evidence."
];

const LIVE_PHRASES = [
    "The first mark has been made. The record is live.",
    "The seed has broken ground. Every trade leaves a trace.",
    "The bonding curve is active. Visibility has replaced trust.",
    "Movement has begun. The ledger remembers every hand.",
    "The signal has arrived. The receiver records without comment.",
    "Participation is voluntary. Permanence is not.",
    "What moves here remains legible after the moment passes.",
    "The apparatus is live. Attention has become evidence.",
    "The ledger does not forgive. It only confirms.",
    "Every inscription commits. Nothing returns to silence."
];

const PUMPSWAP_PHRASES = [
    "Migration complete. The seed now moves in open water.",
    "The bonding curve has closed. The public market carries the record.",
    "Every swap commits. Visibility continues without pause.",
    "The apparatus is live on PumpSwap. Nothing leaves without a trace.",
    "The ledger does not conclude. It persists in plain sight."
];

export const HauntedMarquee: React.FC<{ mode?: string }> = ({ mode = 'pre-launch' }) => {
    const [text, setText] = useState("");
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const pool = mode === 'pumpswap'
            ? PUMPSWAP_PHRASES
            : mode === 'pre-launch'
                ? PRE_LAUNCH_PHRASES
                : LIVE_PHRASES;

        const cycle = () => {
            const randomPhrase = pool[Math.floor(Math.random() * pool.length)];
            setText(randomPhrase);
            setOpacity(1);

            timeout = setTimeout(() => {
                setOpacity(0);
                timeout = setTimeout(cycle, 5000);
            }, 8000 + Math.random() * 4000);
        };

        cycle();
        return () => clearTimeout(timeout);
    }, [mode]);

    return (
        <div className="marquee-wrapper" style={{
            position: 'absolute',
            top: '45px',
            left: 0,
            width: '100%',
            zIndex: 15,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
        }}>
            <div className="marquee-text" style={{
                opacity: opacity,
                transition: 'opacity 2s ease-in-out',
                color: '#C0C0C0',
                fontWeight: 'bold',
                fontFamily: 'system-ui, sans-serif',
                textShadow: '0 0 4px rgba(255, 255, 255, 0.4), 0 0 8px rgba(192, 192, 192, 0.2)',
                filter: 'drop-shadow(0 0 8px rgba(139, 0, 0, 0.6)) blur(0.3px)',
                letterSpacing: '0.05em',
                textAlign: 'center'
            }}>
                {text}
            </div>
        </div>
    );
};
