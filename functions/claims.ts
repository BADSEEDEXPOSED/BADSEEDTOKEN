// functions/claims.ts
import type { Handler } from "@netlify/functions";
import { redis } from "@lib/redis";
import { redisKeys } from "@lib/tokenConfig";

export const handler: Handler = async (event) => {
    const query = event.queryStringParameters || {};
    const limit = query.limit ? Number(query.limit) : 50;

    const raw = await redis.zrevrange<string[]>(redisKeys.tsFeesCum, 0, limit - 1);
    const items = raw.map((v) => JSON.parse(v));

    return {
        statusCode: 200,
        body: JSON.stringify({ claims: items })
    };
};
