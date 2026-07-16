import { getBalances, type BalanceSource, type GetBalancesResult } from '@circle-fin/unified-balance-kit'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { GATEWAY_CHAIN_BY_ID, GATEWAY_SUPPORTED_CHAIN_IDS } from '../config/gatewayChains'
import { useSolanaWallet } from '../context/SolanaWalletContext'
import { unifiedBalanceContext } from '../lib/unifiedBalanceKit'
import { useEvmAdapter } from './useEvmAdapter'
import { useSolanaAdapter } from './useSolanaAdapter'

const EVM_GATEWAY_CHAINS = GATEWAY_SUPPORTED_CHAIN_IDS.filter((id) => id !== 'solana').map((id) => GATEWAY_CHAIN_BY_ID[id])

export interface GatewayChainBalance {
  chain: string
  confirmedBalance: string
  pendingBalance: string
}

// Modest safety-net poll — same rationale as useUsdcBalances (Helius/RPC-adjacent Gateway API is
// rate-limit-conscious per its own docs: "retries failed requests up to 10 times").
const BALANCE_POLL_INTERVAL_MS = 20_000

/**
 * Real Gateway unified balance — genuinely backed by Circle's Gateway API via getBalances(), not
 * a per-chain wallet balance. Distinguishes confirmed (spendable) from pending (deposited but not
 * yet chain-finalized) amounts, since a deposit's finality can lag its on-chain confirmation by
 * real time on slower source chains (see GatewayDepositSnapshot in activityLogWrites.ts).
 */
export function useGatewayBalances() {
  const { address: walletAddress, isConnected: evmConnected } = useAccount()
  const { connected: solanaConnected, address: solanaAddress } = useSolanaWallet()
  const { adapter: evmAdapter } = useEvmAdapter()
  const solanaAdapter = useSolanaAdapter()

  const evmReady = evmConnected && Boolean(evmAdapter)
  const solanaReady = solanaConnected && Boolean(solanaAdapter) && Boolean(solanaAddress)
  const enabled = evmReady || solanaReady

  const { data, isLoading, isError, error, refetch } = useQuery<GetBalancesResult>({
    queryKey: ['gateway-balances', walletAddress, evmReady, solanaAddress, solanaReady],
    queryFn: async () => {
      const sources: BalanceSource[] = []
      if (evmReady && evmAdapter) sources.push({ adapter: evmAdapter, chains: EVM_GATEWAY_CHAINS })
      if (solanaReady && solanaAdapter) sources.push({ adapter: solanaAdapter, chains: GATEWAY_CHAIN_BY_ID.solana })
      return getBalances(unifiedBalanceContext, {
        sources,
        networkType: 'testnet',
        includePending: true,
      })
    },
    enabled,
    refetchInterval: BALANCE_POLL_INTERVAL_MS,
  })

  const perChain: GatewayChainBalance[] = (data?.breakdown ?? []).flatMap((account) =>
    account.breakdown.map((entry) => ({
      chain: entry.chain,
      confirmedBalance: entry.confirmedBalance,
      pendingBalance: entry.pendingBalance ?? '0',
    })),
  )

  // Every deposit tx hash Gateway still considers pending (not yet finalized), across all chains —
  // used by useReconcileGatewayDeposits to detect when a Firestore-persisted 'pending' deposit has
  // actually finalized (its tx hash drops out of this set).
  const pendingTxHashes = new Set(
    (data?.breakdown ?? []).flatMap((account) =>
      account.breakdown.flatMap((entry) => entry.pendingTransactions?.map((tx) => tx.transactionHash) ?? []),
    ),
  )

  return {
    perChain,
    totalConfirmed: data ? Number(data.totalConfirmedBalance) : 0,
    totalPending: data?.totalPendingBalance ? Number(data.totalPendingBalance) : 0,
    pendingTxHashes,
    hasLoadedOnce: data !== undefined,
    isLoading: enabled && isLoading,
    isError,
    error,
    refetch,
    enabled,
  }
}
