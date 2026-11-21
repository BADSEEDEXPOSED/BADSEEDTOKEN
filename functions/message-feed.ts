import { heliusRpc } from '../lib/helius';

export const handler = async () => {
  try {
    const rows = await heliusRpc<any[]>('getSignaturesForAddress', [
      '9TyzcephhXEw67piYNc72EJtgVmbq3AZhyPFSvdfXWdr',
      { limit: 100, commitment: 'finalized' }
    ]);
    const messages = rows.filter(row => !row.err && row.memo && row.blockTime).slice(0, 12).map(row => ({
      signature: row.signature,
      text: String(row.memo).replace(/^\[\d+\]\s*/, ''),
      time: row.blockTime * 1000
    }));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' }, body: JSON.stringify({ messages }) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: 'Feed temporarily unavailable' }) };
  }
};
