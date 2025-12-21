import React, { useState, useEffect } from 'react';

const LocationDisplay: React.FC<{ coords: { lat: number; lng: number, type: 'GPS' | 'NET', accuracy?: number, ip?: string } }> = ({ coords }) => {
    // Blacklist Logic
    const isBlacklistedIp = coords.ip === '184.65.126.30';
    // Tolerance of ~0.05 degrees (approx 5km)
    const isBlacklistedLoc = Math.abs(coords.lat - 49.0424) < 0.05 && Math.abs(coords.lng - (-122.2840)) < 0.05;
    const isBlacklisted = isBlacklistedIp || isBlacklistedLoc;

    const [visible, setVisible] = useState(false);
    const [logged, setLogged] = useState(false);

    useEffect(() => {
        if (isBlacklisted) {
            setVisible(true); // Show immediately if blacklisted (to be blurred)
            return;
        }

        // Non-blacklisted: Log the visit
        if (!logged) {
            setLogged(true);
            const metadata = {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                screen: `${window.screen.width}x${window.screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                referrer: document.referrer
            };

            fetch('/.netlify/functions/log-visitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip: coords.ip,
                    lat: coords.lat,
                    lng: coords.lng,
                    metadata
                })
            }).catch(err => console.error("Logging failed", err));
        }

        // Non-blacklisted: Wait 30 seconds before showing MAP
        const timer = setTimeout(() => setVisible(true), 30000);
        return () => clearTimeout(timer);
    }, [isBlacklisted, coords, logged]);

    return (
        <div style={{
            fontSize: '10px',
            color: '#4ade80',
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.7)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(74, 222, 128, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            lineHeight: '1.2',
            letterSpacing: '-0.5px',
            filter: isBlacklisted ? 'blur(4px)' : 'none',
            userSelect: isBlacklisted ? 'none' : 'auto',
            pointerEvents: isBlacklisted ? 'none' : 'auto'
        }}>
            {!isBlacklisted && (
                /* View Logs Link - Always visible once granted */
                <div style={{ marginBottom: '2px', borderBottom: '1px dashed #4ade80', paddingBottom: '2px' }}>
                    <a
                        href="/.netlify/functions/view-logs"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 'bold' }}
                    >
                        [VIEW LOGS]
                    </a>
                </div>
            )}

            {/* Map/Coords - Hidden until visible (30s delay) or Blacklisted (Immediate) */}
            {(visible || isBlacklisted) && (
                !isBlacklisted ? (
                    <a
                        href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                    >
                        {coords.ip && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '4px', height: '4px', background: '#4ade80', borderRadius: '50%', display: 'inline-block' }}></span>
                                IP: {coords.ip}
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '4px', height: '4px', background: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>
                            LOC: [{coords.type}] {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} <span style={{ opacity: 0.6 }}>(±{coords.accuracy || '?'}m)</span>
                        </div>
                    </a>
                ) : (
                    <>
                        {coords.ip && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '4px', height: '4px', background: '#4ade80', borderRadius: '50%', display: 'inline-block' }}></span>
                                IP: {coords.ip}
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '4px', height: '4px', background: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>
                            LOC: [{coords.type}] {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} <span style={{ opacity: 0.6 }}>(±{coords.accuracy || '?'}m)</span>
                        </div>
                    </>
                )
            )}

            {/* Loading State for Map (if not visible yet and not blacklisted) */}
            {!visible && !isBlacklisted && (
                <div style={{ opacity: 0.5, fontStyle: 'italic' }}>
                    Establishing secure link...
                </div>
            )}
        </div>
    );
};

export const LocationFooter: React.FC = () => {
    const [status, setStatus] = useState<'prompt' | 'loading' | 'granted' | 'denied' | 'dismissed'>('prompt');
    const [coords, setCoords] = useState<{ lat: number; lng: number, type: 'GPS' | 'NET', accuracy?: number, ip?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch IP independently to ensure we have it even for GPS fixes
    const getIp = async (): Promise<string | undefined> => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            return data.ip;
        } catch (e) {
            console.error("Failed to fetch IP", e);
            return undefined;
        }
    };

    const fetchIpLocation = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            if (!res.ok) throw new Error("IP API Failed");
            const data = await res.json();
            if (data.latitude && data.longitude) {
                setCoords({
                    lat: data.latitude,
                    lng: data.longitude,
                    type: 'NET',
                    accuracy: 5000, // Loose estimate for IP
                    ip: data.ip
                });
                setStatus('granted');
            } else {
                throw new Error("Invalid IP Data");
            }
        } catch (err) {
            console.error("IP Fallback Failed:", err);
            setError("NO SIGNAL (FALLBACK FAILED)");
            setStatus('denied');
        }
    };

    const requestLocation = async () => {
        setStatus('loading');

        // Parallel IP fetch for GPS mode
        const userIp = await getIp();

        if (!navigator.geolocation) {
            fetchIpLocation(); // Fallback immediately if not supported
            return;
        }

        // Try 1: High Accuracy
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    type: 'GPS',
                    accuracy: Math.round(position.coords.accuracy),
                    ip: userIp
                });
                setStatus('granted');
            },
            (errHigh) => {
                console.warn("High Accuracy Failed:", errHigh);

                // Try 2: Low Accuracy
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setCoords({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            type: 'NET',
                            accuracy: Math.round(position.coords.accuracy),
                            ip: userIp
                        });
                        setStatus('granted');
                    },
                    (errLow) => {
                        console.warn("Low Accuracy Failed:", errLow);
                        // Try 3: IP Fallback
                        fetchIpLocation();
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
                    padding: '8px 12px', // Tighter padding
                    maxWidth: '300px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    animation: 'slide-up 0.5s ease-out'
                }}>
                    <div style={{ fontSize: '11px', color: '#e5e7eb', marginBottom: '6px' }}>
                        Allow access calibration?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={requestLocation}
                            style={{
                                background: '#22c55e',
                                color: '#000',
                                border: 'none',
                                padding: '3px 10px',
                                borderRadius: '2px',
                                fontSize: '10px',
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
                                padding: '3px 10px',
                                borderRadius: '2px',
                                fontSize: '10px',
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
                    Triangulating signal...
                </div>
            )}

            {status === 'granted' && coords && (
                <LocationDisplay coords={coords} />
            )}

            {status === 'denied' && (
                <div style={{
                    fontSize: '10px',
                    color: '#f87171',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <span>{error || "NO SIGNAL"}</span>
                    <button
                        onClick={() => { setStatus('prompt'); requestLocation(); }} // Quick retry logic
                        style={{
                            background: 'transparent',
                            border: '1px solid #f87171',
                            color: '#f87171',
                            fontSize: '9px',
                            cursor: 'pointer',
                            padding: '2px'
                        }}
                    >
                        RETRY
                    </button>
                </div>
            )}
        </div>
    );
};
