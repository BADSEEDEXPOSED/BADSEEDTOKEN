// lib/redis.ts
import { Redis } from "@upstash/redis";
import { ENV } from "./env";

let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
        const rawUrl = (process.env.UPSTASH_REDIS_REST_URL || ENV.UPSTASH_REDIS_REST_URL || "").trim().replace(/^["']|["']$/g, "");
        const rawToken = (process.env.UPSTASH_REDIS_REST_TOKEN || ENV.UPSTASH_REDIS_REST_TOKEN || "").trim().replace(/^["']|["']$/g, "");
        _redis = new Redis({ url: rawUrl, token: rawToken });
    }
    return _redis;
}

export const redis = new Proxy({} as Redis, {
    get(_target, prop) {
        const client = getRedis() as any;
        const val = client[prop];
        return typeof val === "function" ? val.bind(client) : val;
    }
});
