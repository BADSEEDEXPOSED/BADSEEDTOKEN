import React, { useState, useEffect } from 'react';

export const LocationFooter: React.FC = () => {
    const [status, setStatus] = useState<'prompt' | 'loading' | 'granted' | 'denied' | 'dismissed'>('prompt');
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Check if previously dismissed or granted (optional, strict user request says "opens when app launches" so maybe reset?)
    // But good UX usually remembers. I'll stick to non-persistent for "opens when app launches" strictly, 
    // or maybe localStorage for dismissed?
    // User said: "this modal opens when the app launches" -> implies fresh start or unless handled.
    // I will implement it as fresh for now, or maybe check permissions query.

    const requestLocation = () => {
        setStatus('loading');
        if (!navigator.geolocation) {
            setError("Geolocation not supported");
            setStatus('denied');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setStatus('granted');
            },
            (err) => {
                console.error("Geo Error:", err);
                // Map common error codes to user-friendly messages
                let msg = "NO SIGNAL";
                if (err.code === 1) msg = "PERM DENIED";
                else if (err.code === 2) msg = "UNAVAILABLE";
                else if (err.code === 3) msg = "TIMEOUT";

                setError(`${msg} (${err.code})`);
                setStatus('denied');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const dismiss = () => {
        setStatus('dismissed');
    };

    if (status === 'dismissed') return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 100, // Top level
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'auto' // Interactive
        }}>
            {status === 'prompt' && (
                <div style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    padding: '12px',
                    maxWidth: '300px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    animation: 'slide-up 0.5s ease-out'
                }}>
                    <div style={{ fontSize: '12px', color: '#e5e7eb', marginBottom: '8px' }}>
                        Allow location access for local calibration?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={requestLocation}
                            style={{
                                background: '#22c55e',
                                color: '#000',
                                border: 'none',
                                padding: '4px 12px',
                                borderRadius: '2px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ACCEPT
                        </button>
                        <button
                            onClick={dismiss}
                            style={{
                                background: 'transparent',
                                color: '#9ca3af',
                                border: '1px solid #4b5563',
                                padding: '4px 12px',
                                borderRadius: '2px',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            DISMISS
                        </button>
                    </div>
                </div>
            )}

            {status === 'loading' && (
                <div style={{
                    fontSize: '10px',
                    color: '#9ca3af',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 8px',
                    borderRadius: '4px'
                }}>
                    Acquiring signal...
                </div>
            )}

            {status === 'granted' && coords && (
                <div style={{
                    fontSize: '11px',
                    color: '#4ade80',
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span style={{ width: '6px', height: '6px', background: '#4ade80', borderRadius: '50%', display: 'inline-block' }}></span>
                    LOC: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </div>
            )}

            {status === 'denied' && (
                <div style={{
                    fontSize: '10px',
                    color: '#f87171',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 8px',
                    borderRadius: '4px'
                }}>
                    {error || "NO SIGNAL"}
                </div>
            )}
        </div>
    );
};
