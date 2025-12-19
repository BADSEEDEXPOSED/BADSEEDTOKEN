// lib/env.ts
export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.warn(`Missing env var: ${name} (Using mock/empty for local dev)`);
        return "";
    }
    return value;
}

export const ENV = {
    UPSTASH_REDIS_REST_URL: requireEnv("UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    HELIUS_API_KEY: requireEnv("HELIUS_API_KEY"),
    CREATOR_SECRET_KEY: requireEnv("CREATOR_SECRET_KEY"), // JSON array string of 64-byte secret key
    WEBHOOK_AUTH_TOKEN: process.env.WEBHOOK_AUTH_TOKEN || "superfancysecretbadseed", // Optional, with default
    QUICKNODE_RPC_URL: process.env.QUICKNODE_RPC_URL || "https://soft-ancient-leaf.solana-mainnet.quiknode.pro/491845835e98a8a73eec0601d9c3ec271e5c0537/" // User provided fallback RPC
};
