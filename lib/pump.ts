
import { Connection, PublicKey } from "@solana/web3.js";

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

export interface BondingCurveState {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;
}

// Layout based on Pump.fun IDL
// Discriminator: 8 bytes
// Virtual Token Reserves: 8 bytes (u64)
// Virtual Sol Reserves: 8 bytes (u64)
// Real Token Reserves: 8 bytes (u64)
// Real Sol Reserves: 8 bytes (u64)
// Token Total Supply: 8 bytes (u64)
// Complete: 1 byte (bool)

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
            const accountInfo = await this.connection.getAccountInfo(pda);

            if (!accountInfo || !accountInfo.data) {
                return null;
            }

            const data = accountInfo.data;

            // Skip 8 byte discriminator
            let offset = 8;

            const virtualTokenReserves = data.readBigUInt64LE(offset);
            offset += 8;

            const virtualSolReserves = data.readBigUInt64LE(offset);
            offset += 8;

            const realTokenReserves = data.readBigUInt64LE(offset);
            offset += 8;

            const realSolReserves = data.readBigUInt64LE(offset);
            offset += 8;

            const tokenTotalSupply = data.readBigUInt64LE(offset);
            offset += 8;

            const complete = data.readUInt8(offset) === 1;

            return {
                virtualTokenReserves,
                virtualSolReserves,
                realTokenReserves,
                realSolReserves,
                tokenTotalSupply,
                complete
            };

        } catch (e) {
            console.error("Error fetching bonding curve:", e);
            return null;
        }
    }

    // Helper: Calculate Price in SOL
    calculatePrice(state: BondingCurveState): number {
        if (state.virtualTokenReserves === BigInt(0)) return 0;

        const vSol = Number(state.virtualSolReserves) / 1e9;
        const vToken = Number(state.virtualTokenReserves) / 1e6;

        return vSol / vToken;
    }

    // Helper: Calculate Bonding Progress (0-100%)
    // Uses Token Reserves for deterministic progress calculation
    calculateProgress(state: BondingCurveState): number {
        const vToken = Number(state.virtualTokenReserves) / 1e6;

        const INIT_VTOKEN = 1073000000;
        const TARGET_SOLD = 800000000;

        const tokensSold = INIT_VTOKEN - vToken;
        const pct = (tokensSold / TARGET_SOLD) * 100;

        return Math.min(100, Math.max(0, pct));
    }
}
