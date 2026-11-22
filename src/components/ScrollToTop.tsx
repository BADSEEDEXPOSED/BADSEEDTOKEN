import React, { useState, useEffect } from 'react';

export const ScrollToTop: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            const scrolledMap = document.documentElement.scrollTop || document.body.scrollTop;
            const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            if (totalHeight <= 0) return;
            setVisible(scrolledMap / totalHeight > 0.75);
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <button
            onClick={scrollToTop}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 100,
                padding: '10px',
                borderRadius: '2px 10px 2px 2px',
                background: 'linear-gradient(115deg, rgba(195, 216, 237, 0.14), rgba(7, 11, 17, 0.84) 55%, rgba(91, 111, 133, 0.12))',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: '#eef5fc',
                border: '1px solid rgba(186, 202, 219, 0.34)',
                borderLeft: '2px solid rgba(229, 239, 250, 0.85)',
                cursor: 'pointer',
                opacity: visible ? 1 : 0,
                visibility: visible ? 'visible' : 'hidden',
                transition: 'opacity 0.35s ease, visibility 0.35s, border-color 0.2s ease',
                boxShadow: 'inset 0 1px rgba(244, 249, 255, 0.14), 0 6px 22px rgba(0, 0, 0, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '42px',
                height: '42px',
                pointerEvents: 'auto'
            }}
            className="scroll-to-top-btn"
            aria-label="Scroll to top"
            title="Scroll to top"
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M18 15l-6-6-6 6" />
            </svg>
        </button>
    );
};
