import React, { useState, useEffect } from 'react';

const HAUNTED_PHRASES = [
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

export const HauntedMarquee: React.FC = () => {
    const [text, setText] = useState("");
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const cycle = () => {
            // 1. Pick Random Phrase
            const randomPhrase = HAUNTED_PHRASES[Math.floor(Math.random() * HAUNTED_PHRASES.length)];
            setText(randomPhrase);

            // 2. Phase In (Slowly)
            setOpacity(1);

            // 3. Hold for 8-12 seconds (Longer display)
            timeout = setTimeout(() => {
                // 4. Phase Out
                setOpacity(0);

                // 5. Wait 5 seconds then restart (Longer pause)
                timeout = setTimeout(cycle, 5000);
            }, 8000 + Math.random() * 4000);
        };

        // Start initial cycle
        cycle();

        return () => clearTimeout(timeout);
    }, []);

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
