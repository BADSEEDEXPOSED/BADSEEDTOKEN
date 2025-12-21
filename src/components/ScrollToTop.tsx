import React, { useState, useEffect } from 'react';

export const ScrollToTop: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            // Calculate scroll percentage
            // We want to know if we are in the "bottom 15%" of the page content.
            // Formula: If (scrollY) > (Total Height - Viewport) * 0.85

            const scrolledMap = document.documentElement.scrollTop || document.body.scrollTop;
            const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

            // Safety check for unsizable pages
            if (totalHeight <= 0) return;

            const scrollPercentage = scrolledMap / totalHeight;

            // User Requirement: "does not show if the page is showing the top 85%"
            // This implies it shows only when passed 85% of the scrollable area.
            if (scrollPercentage > 0.85) {
                setVisible(true);
            } else {
                setVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <button
            onClick={scrollToTop}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 100,
                padding: '12px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#4ade80', // Green Accent
                border: '1px solid #4ade80',
                cursor: 'pointer',
                opacity: visible ? 1 : 0,
                visibility: visible ? 'visible' : 'hidden', // Prevent clicks when hidden
                transition: 'opacity 0.4s ease, visibility 0.4s',
                boxShadow: '0 0 10px rgba(74, 222, 128, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px'
            }}
            className="scroll-to-top-btn"
            aria-label="Scroll to top"
        >
            <svg
                width="20"
                height="20"
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
