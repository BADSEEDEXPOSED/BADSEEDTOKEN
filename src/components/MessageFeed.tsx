import React, { useEffect, useState } from 'react';
import { functionUrl } from '../api';
type Message = { signature: string; text: string; time: number };

export function MessageFeed() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(functionUrl('message-feed'), { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.messages)) setMessages(data.messages);
      } catch { /* Preserve the last successful feed during interruptions. */ }
    };
    refresh();
    const poll = window.setInterval(refresh, 20000);
    const clock = window.setInterval(() => setNow(Date.now()), 10000);
    return () => { controller.abort(); clearInterval(poll); clearInterval(clock); };
  }, []);
  return <aside className="seed-message-feed" aria-label="Messages to the Seed">
    <div className="seed-feed-label">TRANSMISSIONS / ON-CHAIN</div>
    <div className="seed-feed-stream" tabIndex={0} aria-label="Scroll transmission history" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div className="seed-feed-message" key={message.signature}
        style={{ opacity: Math.max(.8, 1 - index * .015 - Math.min(.1, Math.max(0, now - message.time) / 86400000 * .01)) }}>
        <span>{new Date(message.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        <p>{message.text}</p>
      </div>)}
      {!messages.length && <p className="seed-feed-empty">Awaiting inscriptions.</p>}
    </div>
  </aside>;
}
