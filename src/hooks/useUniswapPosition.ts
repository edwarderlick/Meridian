import { formatUnits } from 'viem'
import { useAccount, useReadContract, useReadContracts, useSimulateContract } from 'wagmi'
import { USDC_BY_CHAIN } from '../config/tokens'
import { NFPM_ABI, farDeadline, getUniswapMarket, sortTokens } from '../lib/uniswapClient'
import { useUniswapPool } from './useUniswapPool'

const POSITION_POLL_INTERVAL_MS = 20_000
/** Meridian only ever mints one position per pool — this just bounds how many of a wallet's
 *  OTHER, unrelated Uniswap NFTs (from elsewhere) this hook will scan before giving up. */
const MAX_TOKEN_IDS_SCANNED = 10

/**
 * Real Uniswap V3 LP position for the connected wallet on a given chain — NFT position lives
 * directly in the user's own wallet (Meridian is never the `recipient`/owner), same self-custodial
 * guarantee as useAavePosition's aToken read, just for a different receipt shape.
 *
 * Current withdrawable amount0/amount1 comes from a read-only simulate of decreaseLiquidity() for
 * the position's full liquidity — the real NFPM contract computing the exact number, not a
 * client-side re-implementation of Uniswap's tick/liquidity math (which would risk a silent,
 * confident-looking error in exactly the kind of "looks real but isn't" way this app avoids
 * elsewhere). Unclaimed fees come from positions().tokensOwed directly, which is real on-chain
 * state but only current as of the position's last touch — disclosed as such in the UI, not implied
 * to be live-to-the-second.
 */
export function useUniswapPosition(evmChainId: number) {
  const { address } = useAccount()
  const market = getUniswapMarket(evmChainId)
  const usdc = USDC_BY_CHAIN[evmChainId]
  const pool = useUniswapPool(evmChainId)
  const [token0, token1] = market && usdc ? sortTokens(usdc.address, market.weth) : [undefined, undefined]

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useReadContract({
    chainId: evmChainId,
    address: market?.nfpm,
    abi: NFPM_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && market), refetchInterval: POSITION_POLL_INTERVAL_MS },
  })

  const balanceCount = balance !== undefined ? Math.min(Number(balance), MAX_TOKEN_IDS_SCANNED) : 0
  const indices = Array.from({ length: balanceCount }, (_, i) => i)

  const { data: tokenIdResults, isLoading: tokenIdsLoading } = useReadContracts({
    contracts: indices.map((i) => ({
      chainId: evmChainId,
      address: market?.nfpm,
      abi: NFPM_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: address ? ([address, BigInt(i)] as const) : undefined,
    })),
    query: { enabled: Boolean(address && market && balanceCount > 0) },
  })

  const tokenIds = (tokenIdResults ?? [])
    .map((r) => r.result as bigint | undefined)
    .filter((id): id is bigint => id !== undefined)

  const {
    data: positionResults,
    isLoading: positionsLoading,
    refetch: refetchPositions,
  } = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      chainId: evmChainId,
      address: market?.nfpm,
      abi: NFPM_ABI,
      functionName: 'positions' as const,
      args: [tokenId] as const,
    })),
    query: { enabled: tokenIds.length > 0 },
  })

  // Find the one position (if any) matching THIS pool's token0/token1/fee — a wallet could hold
  // unrelated Uniswap NFTs from elsewhere, only one of which (at most) is Meridian's.
  let matchedTokenId: bigint | undefined
  let matchedLiquidity = 0n
  let matchedTickLower: number | undefined
  let matchedTickUpper: number | undefined
  let matchedOwed0 = 0n
  let matchedOwed1 = 0n

  type PositionTuple = readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, number, number, number, bigint, bigint, bigint, bigint, bigint]

  ;(positionResults ?? []).forEach((r, i) => {
    if (!r.result || !token0 || !token1 || !market) return
    const pos = r.result as unknown as PositionTuple
    const posToken0 = pos[2] as string
    const posToken1 = pos[3] as string
    const posFee = pos[4] as number
    if (posToken0.toLowerCase() === token0.toLowerCase() && posToken1.toLowerCase() === token1.toLowerCase() && posFee === market.fee) {
      matchedTokenId = tokenIds[i]
      matchedTickLower = pos[5] as number
      matchedTickUpper = pos[6] as number
      matchedLiquidity = pos[7] as bigint
      matchedOwed0 = pos[10] as bigint
      matchedOwed1 = pos[11] as bigint
    }
  })

  const hasPosition = matchedTokenId !== undefined && matchedLiquidity > 0n

  const { data: currentAmountsSim } = useSimulateContract({
    chainId: evmChainId,
    address: market?.nfpm,
    abi: NFPM_ABI,
    functionName: 'decreaseLiquidity',
    args:
      hasPosition && matchedTokenId !== undefined
        ? [{ tokenId: matchedTokenId, liquidity: matchedLiquidity, amount0Min: 0n, amount1Min: 0n, deadline: farDeadline() }]
        : undefined,
    account: address,
    query: { enabled: Boolean(address && hasPosition) },
  })

  const currentAmount0 = currentAmountsSim?.result?.[0] ?? 0n
  const currentAmount1 = currentAmountsSim?.result?.[1] ?? 0n

  const decimals0 = token0 && usdc && token0.toLowerCase() === usdc.address.toLowerCase() ? usdc.decimals : 18
  const decimals1 = token1 && usdc && token1.toLowerCase() === usdc.address.toLowerCase() ? usdc.decimals : 18

  const inRange =
    pool.tick !== null && matchedTickLower !== undefined && matchedTickUpper !== undefined
      ? pool.tick >= matchedTickLower && pool.tick < matchedTickUpper
      : null

  return {
    hasPosition,
    tokenId: matchedTokenId,
    liquidity: matchedLiquidity,
    tickLower: matchedTickLower,
    tickUpper: matchedTickUpper,
    inRange,
    token0,
    token1,
    decimals0,
    decimals1,
    currentAmount0,
    currentAmount1,
    currentAmount0Formatted: formatUnits(currentAmount0, decimals0),
    currentAmount1Formatted: formatUnits(currentAmount1, decimals1),
    unclaimedFees0Formatted: formatUnits(matchedOwed0, decimals0),
    unclaimedFees1Formatted: formatUnits(matchedOwed1, decimals1),
    isLoading: balanceLoading || tokenIdsLoading || positionsLoading,
    refetch: () => {
      void refetchBalance()
      void refetchPositions()
    },
  }
}
