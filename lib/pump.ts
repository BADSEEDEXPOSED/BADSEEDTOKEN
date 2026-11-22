import { Connection, PublicKey } from "@solana/web3.js";
import { heliusRpc } from "./helius";

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

export interface BondingCurveState {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;
}

export class PumpFunSDK {
    connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    async getBondingCurvePDA(mint: PublicKey): Promise<PublicKey> {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding-curve"), mint.toBuffer()],
            PUMP_PROGRAM_ID
        );
        return pda;
    }

    async getBondingCurveState(mintStr: string): Promise<BondingCurveState | null> {
        try {
            const mint = new PublicKey(mintStr);
            const pda = await this.getBondingCurvePDA(mint);

            // Use multi-provider heliusRpc with automatic fallback to public Solana mainnet
            const res = await heliusRpc<{ value: { owner: string; data: [string, string] } | null }>(
                "getAccountInfo",
                [pda.toBase58(), { encoding: "base64", commitment: "confirmed" }]
            );

            if (!res || !res.value || !res.value.data || !res.value.data[0]) {
                return null;
            }

            if (res.value.owner !== PUMP_PROGRAM_ID.toBase58()) {
                throw new Error("Invalid bonding curve owner");
            }

            const data = Buffer.from(res.value.data[0], "base64");
            if (data.length < 49) throw new Error("Invalid bonding curve account length");

            let offset = 8; // Skip 8-byte discriminator
            const virtualTokenReserves = data.readBigUInt64LE(offset); offset += 8;
            const virtualSolReserves = data.readBigUInt64LE(offset); offset += 8;
            const realTokenReserves = data.readBigUInt64LE(offset); offset += 8;
            const realSolReserves = data.readBigUInt64LE(offset); offset += 8;
            const tokenTotalSupply = data.readBigUInt64LE(offset); offset += 8;
            const complete = data.readUInt8(offset) === 1;

            return {
                virtualTokenReserves,
                virtualSolReserves,
                realTokenReserves,
                realSolReserves,
                tokenTotalSupply,
                complete,
            };
        } catch (e) {
            throw new Error("Bonding curve lookup failed");
        }
    }

    calculatePrice(state: BondingCurveState): number {
        if (state.virtualTokenReserves === BigInt(0)) return 0;
        const vSol = Number(state.virtualSolReserves) / 1e9;
        const vToken = Number(state.virtualTokenReserves) / 1e6;
        return vSol / vToken;
    }

    calculateProgress(state: BondingCurveState): number {
        const leftToSell = Number(state.realTokenReserves) / 1e6;
        const INITIAL_SALE_SUPPLY = 793100000;
        const pct = 100 - ((leftToSell * 100) / INITIAL_SALE_SUPPLY);
        return Math.min(100, Math.max(0, pct));
    }
}
