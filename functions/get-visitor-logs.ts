// functions/get-visitor-logs.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";

function getExcludedIps(): Set<string> {
    const raw = (typeof process !== "undefined" && process.env?.EXCLUDED_LOG_IPS) || "";
    return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderHtmlPage(entries: any[]): string {
    const rows = entries.length === 0
        ? `<div class="empty">No visitor locations recorded in the last 7 days.</div>`
        : entries.slice().reverse().map((e) => {
            const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : "--";
            const ip = escapeHtml(e.ip || "unknown");
            const lat = e.location?.lat;
            const lng = e.location?.lng;
            const hasCoords = typeof lat === "number" && typeof lng === "number";
            const coords = hasCoords
                ? `<a class="coords" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer">${lat.toFixed(4)}, ${lng.toFixed(4)} ↗</a>`
                : `<span class="muted">no coordinates</span>`;
            const extra = [e.metadata?.timezone, e.metadata?.screen, e.metadata?.platform]
                .filter(Boolean)
                .map(escapeHtml)
                .join(" · ");
            return `<div class="row">
                <div class="main">
                    <span class="ts">${escapeHtml(ts)}</span>
                    <span class="ip">${ip}</span>
                    ${coords}
                </div>
                <div class="meta">${extra}</div>
            </div>`;
        }).join("");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BADSEED // VISITOR LOCATION LOGS</title>
  <link rel="icon" href="/favicon.ico" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 28px 18px 40px; min-height: 100vh;
      background: radial-gradient(ellipse at 20% 0%, rgba(127,166,80,0.08), transparent 45%), #040608;
      color: #eef5fc; font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
    }
    .wrap { max-width: 920px; margin: 0 auto; }
    .head {
      display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid rgba(186,202,219,0.22);
    }
    h1 { margin: 0; font-size: 16px; letter-spacing: 0.2em; color: #9ab886; text-transform: uppercase; }
    .sub { font-size: 11px; color: #8a9bad; margin-top: 4px; letter-spacing: 0.1em; }
    .actions { display: flex; gap: 8px; }
    .btn {
      padding: 6px 12px; font: 600 10px/1 inherit; letter-spacing: 0.14em; text-transform: uppercase;
      color: #eef5fc; text-decoration: none; cursor: pointer;
      background: rgba(16,24,34,0.78); border: 1px solid rgba(186,202,219,0.34); border-left: 2px solid #9ab886;
      border-radius: 2px;
    }
    .btn:hover { background: rgba(127,166,80,0.22); border-color: #9ab886; }
    .card {
      border-radius: 2px 10px 2px 2px; border: 1px solid rgba(186,202,219,0.2);
      border-left: 2px solid rgba(221,234,247,0.65);
      background: linear-gradient(125deg, rgba(195,216,237,0.08), rgba(7,11,17,0.85) 55%, rgba(91,111,133,0.05));
      padding: 12px 16px;
    }
    .row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 10px 0; border-bottom: 1px solid rgba(186,202,219,0.1); font-size: 12px;
    }
    .row:last-child { border-bottom: none; }
    .main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .ts { color: #7f90a2; font-size: 11px; }
    .ip { color: #eef5fc; font-weight: 700; }
    .coords { color: #9ab886; text-decoration: none; }
    .coords:hover { text-decoration: underline; }
    .meta, .muted { color: #7f90a2; font-size: 11px; }
    .empty { padding: 28px 10px; text-align: center; color: #8a9bad; font-size: 12px; letter-spacing: 0.08em; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1>BADSEED // VISITOR LOCATION LOGS</h1>
        <div class="sub">LAST 7 DAYS · RECORDED VISITS: ${entries.length}</div>
      </div>
      <div class="actions">
        <a class="btn" href="?format=json">RAW JSON</a>
        <a class="btn" href="/">← BACK TO SOW</a>
      </div>
    </div>
    <div class="card">${rows}</div>
  </div>
</body>
</html>`;
}

export const handler: Handler = async (event) => {
    const baseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    const accept = String(event.headers?.['accept'] || '');
    const format = event.queryStringParameters?.format || '';
    const wantsHtml = format !== 'json' && accept.includes('text/html');

    try {
        const key = 'analytics:visitor_logs';
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        const logs = await redis.zrange<string[]>(key, sevenDaysAgo, now, {
            byScore: true
        }).catch(() => []);

        const excluded = getExcludedIps();
        const parsed = (logs || [])
            .map((l: string) => {
                try { return typeof l === 'string' ? JSON.parse(l) : l; } catch { return null; }
            })
            .filter((entry: any) => entry && !excluded.has(String(entry.ip || '').trim()));

        if (wantsHtml) {
            return {
                statusCode: 200,
                headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
                body: renderHtmlPage(parsed)
            };
        }

        return {
            statusCode: 200,
            headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify(parsed, null, 2)
        };
    } catch (error: any) {
        console.error("View logs error:", error);
        if (wantsHtml) {
            return {
                statusCode: 200,
                headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
                body: renderHtmlPage([])
            };
        }
        return {
            statusCode: 200,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify([])
        };
    }
};
