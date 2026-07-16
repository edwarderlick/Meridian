import { AaveV3ArbitrumSepolia, AaveV3OptimismSepolia } from '@bgd-labs/aave-address-book'
import type { Address } from 'viem'
import { arbitrumSepolia, optimismSepolia } from 'viem/chains'
import { USDC_BY_CHAIN } from '../config/tokens'

/**
 * Real Aave V3 testnet markets — verified two ways before use here, not imported on trust:
 * (1) cross-checked this package's live values against Aave's own aave-dao/aave-address-book
 * source, and (2) called Pool.getReservesList()/getReserveData() directly against these
 * addresses on live public RPCs (2026-07-16) — both chains returned real, actively-updated
 * reserve data (Arbitrum Sepolia same-day, Optimism Sepolia previous day).
 *
 * Ethereum Sepolia and Base Sepolia were deliberately ruled OUT, despite having Aave V3 markets
 * too: Aave's "USDC" reserve on both is Aave's own separate TestnetERC20 faucet token (confirmed
 * via Etherscan/Basescan source), completely different from the real Circle-issued USDC
 * (FiatTokenProxy) Meridian's Bridge actually delivers there — Pool.getReservesList() on both
 * chains confirmed Meridian's real bridged USDC address isn't even a listed reserve. Supplying
 * it would revert. Arbitrum Sepolia and Optimism Sepolia are the only two of Meridian's existing
 * bridge destinations where Aave's reserve underlying is byte-for-byte the same contract as
 * USDC_BY_CHAIN (verified below, not assumed) — Avalanche Fuji also matches but its reserve rate
 * hadn't moved in ~25 days at verification time, low-confidence for a first integration, so it's
 * left out of scope; Polygon Amoy has no Aave V3 market at all.
 */
export const AAVE_CHAIN_IDS = ['arbitrum', 'optimism'] as const
export type AaveChainId = (typeof AAVE_CHAIN_IDS)[number]

export interface AaveMarketConfig {
  pool: Address
  usdc: Address
  aToken: Address
}

const AAVE_MARKET_BY_EVM_CHAIN_ID: Record<number, AaveMarketConfig> = {
  [arbitrumSepolia.id]: {
    pool: AaveV3ArbitrumSepolia.POOL as Address,
    usdc: AaveV3ArbitrumSepolia.ASSETS.USDC.UNDERLYING as Address,
    aToken: AaveV3ArbitrumSepolia.ASSETS.USDC.A_TOKEN as Address,
  },
  [optimismSepolia.id]: {
    pool: AaveV3OptimismSepolia.POOL as Address,
    usdc: AaveV3OptimismSepolia.ASSETS.USDC.UNDERLYING as Address,
    aToken: AaveV3OptimismSepolia.ASSETS.USDC.A_TOKEN as Address,
  },
}

/**
 * Returns a chain's Aave market config ONLY if the address book's USDC reserve still matches
 * Meridian's own bridged USDC exactly — the entire safety premise of this integration (real
 * bridged funds are what earns yield, never a look-alike token) depends on that equality holding.
 * Degrades to "unsupported chain" rather than throwing, so a future address-book drift disables
 * the Aave deposit action instead of ever risking a supply call against the wrong asset.
 */
export function getAaveMarket(evmChainId: number): AaveMarketConfig | undefined {
  const market = AAVE_MARKET_BY_EVM_CHAIN_ID[evmChainId]
  if (!market) return undefined
  const bridgedUsdc = USDC_BY_CHAIN[evmChainId]
  if (!bridgedUsdc || bridgedUsdc.address.toLowerCase() !== market.usdc.toLowerCase()) {
    console.error(
      `[aaveClient] Aave's USDC reserve on chain ${evmChainId} (${market.usdc}) no longer matches Meridian's bridged USDC (${bridgedUsdc?.address ?? 'unconfigured'}) — refusing to treat this as a supported Aave chain until re-verified.`,
    )
    return undefined
  }
  return market
}

export function isAaveEvmChainId(evmChainId: number | undefined): boolean {
  return evmChainId !== undefined && Boolean(getAaveMarket(evmChainId))
}

/** Minimal Aave V3 Pool ABI — only the three functions this app actually calls. */
export const AAVE_POOL_ABI = [
  {
    name: 'supply',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getReserveData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'configuration', type: 'tuple', components: [{ name: 'data', type: 'uint256' }] },
          { name: 'liquidityIndex', type: 'uint128' },
          { name: 'currentLiquidityRate', type: 'uint128' },
          { name: 'variableBorrowIndex', type: 'uint128' },
          { name: 'currentVariableBorrowRate', type: 'uint128' },
          { name: 'currentStableBorrowRate', type: 'uint128' },
          { name: 'lastUpdateTimestamp', type: 'uint40' },
          { name: 'id', type: 'uint16' },
          { name: 'aTokenAddress', type: 'address' },
          { name: 'stableDebtTokenAddress', type: 'address' },
          { name: 'variableDebtTokenAddress', type: 'address' },
          { name: 'interestRateStrategyAddress', type: 'address' },
          { name: 'accruedToTreasury', type: 'uint128' },
          { name: 'unbacked', type: 'uint128' },
          { name: 'isolationModeTotalDebt', type: 'uint128' },
        ],
      },
    ],
  },
] as const

/** Aave expresses interest rates in "ray" units (1e27 = 100%) — see Aave V3's WadRayMath. */
const RAY = 10n ** 27n

/** Converts Pool.getReserveData().currentLiquidityRate (a ray) into a real supply APY percentage. */
export function liquidityRateToApyPercent(currentLiquidityRate: bigint): number {
  return Number((currentLiquidityRate * 10_000n) / RAY) / 100
}

/** No referral program used here — 0 is Aave's own documented "no referral" value. */
export const AAVE_REFERRAL_CODE = 0
