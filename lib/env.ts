// lib/env.ts
export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const ENV = {
    UPSTASH_REDIS_REST_URL: requireEnv("UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    HELIUS_API_KEY: requireEnv("HELIUS_API_KEY"),
    CREATOR_SECRET_KEY: requireEnv("CREATOR_SECRET_KEY") // JSON array string of 64-byte secret key
};
