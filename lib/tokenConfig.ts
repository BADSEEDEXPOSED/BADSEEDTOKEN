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
    mode: `token:MODE_V2:${TOKEN_CONFIG.mint}`,
    summary: `token:SUMMARY_V2:${TOKEN_CONFIG.mint}`,
    tsPrice: `token:TS:PRICE_V2:${TOKEN_CONFIG.mint}`,
    tsMcap: `token:TS:MCAP_V2:${TOKEN_CONFIG.mint}`,
    tsFeesCum: `token:TS:FEES_CUM_V2:${TOKEN_CONFIG.mint}`,
    tsDonationsCum: `token:TS:DONATIONS_CUM_V2:${TOKEN_CONFIG.mint}`,
    claims: `token:CLAIMS_V2:${TOKEN_CONFIG.mint}`,
    donations: `token:DONATIONS_V2:${TOKEN_CONFIG.mint}`
};
