// functions/metrics.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys } from "@lib/tokenConfig";

export const handler: Handler = async (event) => {
    try {
        const query = event.queryStringParameters || {};
        const from = query.from ? Number(query.from) : Date.now() - 24 * 60 * 60 * 1000;
        const to = query.to ? Number(query.to) : Date.now();

        const [priceRaw, mcapRaw, feesRaw, donationsRaw] = await Promise.all([
            redis.zrange<string[]>(redisKeys.tsPrice, from, to, { byScore: true }).catch(() => []),
            redis.zrange<string[]>(redisKeys.tsMcap, from, to, { byScore: true }).catch(() => []),
            redis.zrange<string[]>(redisKeys.tsFeesCum, from, to, { byScore: true }).catch(() => []),
            redis.zrange<string[]>(redisKeys.tsDonationsCum, from, to, { byScore: true }).catch(() => [])
        ]);

        const parse = (arr: string[]) => (arr || []).map((x) => JSON.parse(x));

        const response = {
            price: parse(priceRaw),
            market_cap: parse(mcapRaw),
            fees_claimed_cumulative: parse(feesRaw),
            donations_cumulative: parse(donationsRaw)
        };

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };
    } catch (e) {
        console.error("Metrics error:", e);
        return {
            statusCode: 200,
            body: JSON.stringify({
                price: [],
                market_cap: [],
                fees_claimed_cumulative: [],
                donations_cumulative: []
            })
        };
    }
};
