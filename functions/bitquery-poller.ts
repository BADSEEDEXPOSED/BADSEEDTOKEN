import type { Handler } from "@netlify/functions";
import { redis } from "../lib/redis";
import { TOKEN_CONFIG } from "../lib/tokenConfig";

// BitQuery V2 Endpoint
const BITQUERY_ENDPOINT = "https://streaming.bitquery.io/graphql";
const CACHE_KEY_DATA = "bitquery_cache:data";
const CACHE_KEY_TS = "bitquery_cache:timestamp";
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 Minutes

// Query for 1-hour candles (OHLC) for the last 24 hours
const QUERY = `
query ($mint: String!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: {Mint: {is: $mint}}
        }
      }
      orderBy: {descending: Block_Time}
      limit: 24
    ) {
      Block {
        Time(interval: {count: 60, unit: minute})
      }
      volume: sum(of: Trade_Amount)
      high: max(of: Trade_Price)
      low: min(of: Trade_Price)
      open: minimum(of: Block_Time, get: Trade_Price)
      close: maximum(of: Block_Time, get: Trade_Price)
    }
  }
}
`;

export const handler: Handler = async () => {
  try {
    const now = Date.now();
    const lastUpdatedStr = await redis.get<string>(CACHE_KEY_TS);
    const lastUpdated = lastUpdatedStr ? parseInt(lastUpdatedStr) : 0;

    const cachedData = await redis.get<string>(CACHE_KEY_DATA);

    // 1. Check Cache
    if (cachedData && (now - lastUpdated < CACHE_TTL_MS)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: cachedData // Already a JSON string
      };
    }

    // 2. Fetch Fresh Data
    console.log("Refreshing BitQuery Chart Data...");
    const token = process.env.BITQUERY_TOKEN;
    if (!token) {
      console.error("Missing BITQUERY_TOKEN in env");
      return { statusCode: 500, body: JSON.stringify({ error: "Configuration Error" }) };
    }

    const response = await fetch(BITQUERY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          mint: TOKEN_CONFIG.mint
        }
      })
    });

    const json = await response.json();

    if (json.errors) {
      console.error("BitQuery API Errors:", json.errors);
      // If API fails, return cached data even if stale, if available
      if (cachedData) return { statusCode: 200, body: cachedData };
      return { statusCode: 500, body: JSON.stringify({ error: "API Error" }) };
    }

    // 3. Transform Data
    const rawData = json.data?.Solana?.DEXTradeByTokens || [];

    const chartData = rawData.map((d: any) => ({
      t: d.Block.Time,
      o: parseFloat(d.open || "0"),
      h: parseFloat(d.high || "0"),
      l: parseFloat(d.low || "0"),
      c: parseFloat(d.close || "0"),
      v: parseFloat(d.volume || "0")
    })).reverse(); // Oldest first for charting

    const finalBody = JSON.stringify({
      ok: true,
      chart: chartData,
      updatedAt: now
    });

    // 4. Save to Cache
    await redis.set(CACHE_KEY_DATA, finalBody);
    await redis.set(CACHE_KEY_TS, now.toString());

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: finalBody
    };

  } catch (e) {
    console.error("BitQuery Poller Execution Error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: (e as Error).message }) };
  }
};
