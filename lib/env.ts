// lib/env.ts
export function requireEnv(name: string): string {
    return (typeof process !== "undefined" && process.env && process.env[name]) || "";
}

export const ENV = {
    get UPSTASH_REDIS_REST_URL() { return requireEnv("UPSTASH_REDIS_REST_URL"); },
    get UPSTASH_REDIS_REST_TOKEN() { return requireEnv("UPSTASH_REDIS_REST_TOKEN"); },
    get HELIUS_API_KEY() { return requireEnv("HELIUS_API_KEY"); },
    get CREATOR_SECRET_KEY() { return requireEnv("CREATOR_SECRET_KEY"); },
    get WEBHOOK_AUTH_TOKEN() { return requireEnv("WEBHOOK_AUTH_TOKEN"); },
    get QUICKNODE_RPC_URL() { return requireEnv("QUICKNODE_RPC_URL"); },
};
