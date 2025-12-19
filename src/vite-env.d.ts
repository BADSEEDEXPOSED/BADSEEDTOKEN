/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="vite/client" />

declare module "*.mp4" {
    const src: string;
    export default src;
}

export type TokenSummary = {
    mint: string;
    symbol: string;
    name: string;
    creator_wallet: string;
    donation_wallet: string;
    price_sol: number;
    market_cap_sol: number;
    curve_progress: number;
    total_fees_claimed_sol: number;
    total_donated_sol: number;
    pre_launch_donated_sol: number;
    mode: string;
    last_updated: string | null;
    debug_price?: string;
    debug_mcap?: string;
    debug_progress?: string;
    supply_total: number;
    supply_community: number;
    supply_dev: number;
    supply_donation: number;
    supply_burn: number;
};
