import { handler as ammPoller } from './functions/amm-poller';
import { handler as bitqueryPoller } from './functions/bitquery-poller';
import { handler as claims } from './functions/claims';
import { handler as feeWorker } from './functions/fee-worker';
import { handler as getVisitorLogs } from './functions/get-visitor-logs';
import guardianHandler from './functions/guardian';
import { handler as logVisitor } from './functions/log-visitor';
import { handler as marketSnapshot } from './functions/market-snapshot';
import { handler as messageFeed } from './functions/message-feed';
import { handler as metrics } from './functions/metrics';
import { handler as summary } from './functions/summary';
import { handler as tokenHistory } from './functions/token-history';
import { handler as visitorGet } from './functions/visitor-get';
import { handler as visitorTrack } from './functions/visitor-track';
import { handler as webhookHelius } from './functions/webhook-helius';

const V1_ROUTES: Record<string, any> = {
  'amm-poller': ammPoller,
  'bitquery-poller': bitqueryPoller,
  'claims': claims,
  'fee-worker': feeWorker,
  'get-visitor-logs': getVisitorLogs,
  'view-logs': getVisitorLogs,
  'log-visitor': logVisitor,
  'market-snapshot': marketSnapshot,
  'message-feed': messageFeed,
  'metrics': metrics,
  'summary': summary,
  'token-history': tokenHistory,
  'visitor-get': visitorGet,
  'visitor-track': visitorTrack,
  'webhook-helius': webhookHelius,
};

function syncEnv(env: Record<string, any>) {
  if (typeof process !== 'undefined' && process.env && env) {
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === 'string') process.env[k] = v;
    }
  }
}

async function invokeV1(fn: any, request: Request, env: Record<string, any>): Promise<Response> {
  syncEnv(env);
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const queryStringParameters: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { queryStringParameters[k] = v; });
  const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined;

  const event = {
    httpMethod: request.method,
    path: url.pathname,
    rawUrl: request.url,
    rawQuery: url.search.replace(/^\?/, ''),
    headers,
    queryStringParameters,
    body,
    isBase64Encoded: false,
  };

  const result = await fn(event, {});
  const outHeaders = new Headers();
  if (result?.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      if (v !== undefined && v !== null) outHeaders.set(k, String(v));
    }
  }
  return new Response(result?.body ?? '', {
    status: result?.statusCode || 200,
    headers: outHeaders,
  });
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    syncEnv(env);
    const url = new URL(request.url);
    const p = url.pathname;

    if (p.startsWith('/.netlify/functions/')) {
      const name = p.slice('/.netlify/functions/'.length).split('/')[0];
      if (name === 'guardian') return guardianHandler(request);
      if (V1_ROUTES[name]) return invokeV1(V1_ROUTES[name], request, env);
      return new Response(JSON.stringify({ error: `Unknown function: ${name}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const resp = await env.ASSETS.fetch(request);
    if (p.endsWith('.mp4')) {
      const h = new Headers(resp.headers);
      h.set('Content-Type', 'video/mp4');
      h.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
    }
    return resp;
  },

  async scheduled(event: any, env: any, ctx: any) {
    syncEnv(env);
    if (event.cron === '*/1 * * * *') {
      ctx.waitUntil(invokeV1(ammPoller, new Request('https://token.badseed.exposed/.netlify/functions/amm-poller'), env));
    } else if (event.cron === '10 0,18 * * *') {
      const req = new Request('https://token.badseed.exposed/.netlify/functions/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_run: new Date().toISOString() }),
      });
      ctx.waitUntil(guardianHandler(req));
    }
  },
};
