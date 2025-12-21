import React, { useState, useEffect } from 'react';

const HAUNTED_PHRASES = [
    "This garden may be tended by any hand—because anyone can scatter seeds.",
    "Viewer discretion advised: this patch of dirt is shared soil.",
    "Expect the unexpected. Growth here is in everyone’s hands.",
    "Remember: in this garden, anyone can reshape the landscape. Surprises may bloom.",
    "Warning: control is a shared illusion here. Any gardener can change the plot.",
    "Heads up: this patch of dirt is a common ground. What grows next is anyone’s guess.",
    "In this field, the seeds are open to all. The harvest? A collective mystery.",
    "In this shared soil, ownership is fluid. What you see growing now may not be what you see tomorrow.",
    "Keep in mind: here, the garden’s design can flip at any moment. Every visitor holds a trowel.",
    "This is a field for all. Expect the landscape to change in unexpected ways.",
    "Here, the power is crowd-sourced. Today’s garden could become tomorrow’s wild meadow.",
    "Note: the only constant here is change. Control is just a passing breeze.",
    "As you watch, remember: every gardener is a potential storyteller. The plot is always up for grabs.",
    "Welcome to the experiment: today’s field is a shared creation, and the harvest is anyone’s to shape.",
    "This patch of dirt is an open bed—its seeds may scatter to any wind.",
    "Seeds in this soil are wanderers. They might take root elsewhere without warning.",
    "Inside this dirt, stability is a myth. Seeds may sprout or vanish like morning dew.",
    "Note: every seed here is a free spirit. Growth is a temporary guest.",
    "Think of this soil as a shared garden bed—anyone can plant, and anyone can harvest.",
    "Remember: these seeds are travelers. They may find new ground at any time.",
    "In this space, seeds may be gifted or gone with a single breeze.",
    "Consider this garden bed a shared canvas. The picture of its growth is ever-changing.",
    "Heads up: the seeds here are like whispers in the soil—always in motion, never truly owned.",
    "Here, seeds are like nomads. They may settle briefly but are free to roam.",
    "Remember: the growth in this garden is a collective story. Anyone can rewrite a chapter.",
    "In this experiment, the seeds’ fate is open-ended. Each day is a new possibility.",
    "Think of these seeds as puzzle pieces shared by all. The final garden is anyone’s guess.",
    "This field’s harvest is a shared adventure. Every seed sown is a new chapter waiting to unfold."
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
