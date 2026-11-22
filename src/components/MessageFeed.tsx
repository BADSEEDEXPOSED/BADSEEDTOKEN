import React, { useEffect, useRef, useState } from 'react';
import { functionUrl } from '../api';

type Message = { signature: string; text: string; time: number };

export function MessageFeed() {
  const [messages, setMessages] = useState<Message[]>([]);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(functionUrl('message-feed'), { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.messages)) setMessages(data.messages);
      } catch {
        /* Preserve the last successful feed during interruptions. */
      }
    };
    refresh();
    const poll = window.setInterval(refresh, 20000);
    return () => {
      controller.abort();
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const el = streamRef.current;
    if (!el || messages.length === 0) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    let lastTime = performance.now();
    let pos = el.scrollTop;
    let pauseUntil = performance.now() + 1200;
    const SPEED_PX_PER_SEC = 18;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (hoveredRef.current) {
        pos = el.scrollTop;
      } else {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 2 && now >= pauseUntil) {
          pos += SPEED_PX_PER_SEC * dt;
          if (pos >= maxScroll) {
            el.scrollTop = maxScroll;
            pos = 0;
            pauseUntil = now + 1800;
          } else {
            el.scrollTop = pos;
          }
        } else if (maxScroll > 2 && pos === 0 && el.scrollTop > 0 && now >= pauseUntil - 400) {
          el.scrollTop = 0;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [messages]);

  const handleMouseEnter = () => {
    hoveredRef.current = true;
    if (streamRef.current) {
      streamRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
  };

  return (
    <aside
      className="seed-message-feed"
      aria-label="Messages to the Seed"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="seed-feed-label">TRANSMISSIONS / ON-CHAIN</div>
      <div
        ref={streamRef}
        className="seed-feed-stream"
        tabIndex={0}
        aria-label="Scroll transmission history"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => (
          <div className="seed-feed-message" key={message.signature}>
            <span>
              {new Date(message.time).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <p>{message.text}</p>
          </div>
        ))}
        {!messages.length && <p className="seed-feed-empty">Awaiting inscriptions.</p>}
      </div>
    </aside>
  );
}
