// lib/tokenConfig.ts
export const TOKEN_CONFIG = {
    mint: "3HPpMLK7LjKFqSnCsBYNiijhNTo7dkkx3FCSAHKSpump",
    symbol: "BADSEED",
    name: "BadSeed",
    creatorWallet: "9TyzcephhXEw67piYNc72EJtgVmbq3AZhyPFSvdfXWdr",
    donationWallet: "CZ7Lv3QNVxbBivGPBhJG7m1HpCtfEDjEusBjjZ3qmVz5",
    network: "mainnet-beta"
};

export const redisKeys = {
    mode: `token:MODE:${TOKEN_CONFIG.mint}`,
    summary: `token:SUMMARY:${TOKEN_CONFIG.mint}`,
    tsPrice: `token:TS:PRICE:${TOKEN_CONFIG.mint}`,
    tsMcap: `token:TS:MCAP:${TOKEN_CONFIG.mint}`,
    tsFeesCum: `token:TS:FEES_CUM:${TOKEN_CONFIG.mint}`,
    tsDonationsCum: `token:TS:DONATIONS_CUM:${TOKEN_CONFIG.mint}`,
    claims: `token:CLAIMS:${TOKEN_CONFIG.mint}`,
    donations: `token:DONATIONS:${TOKEN_CONFIG.mint}`
};
