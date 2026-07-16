import { ViemAdapter } from '@circle-fin/adapter-viem-v2'
import { useEffect, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http, type EIP1193Provider } from 'viem'
import { sendTransaction as viemSendTransaction } from 'viem/actions'
import { useAccount } from 'wagmi'
import { BRIDGE_SUPPORTED_EVM_CHAINS } from '../config/bridgeChains'
import { RPC_URL_BY_CHAIN_ID } from '../config/chains'
import { computeBufferedFees } from '../lib/gasFees'

/**
 * Builds a Bridge Kit ViemAdapter from the connected browser wallet — never a private key.
 *
 * FLAG: the phase brief's `createViemV2AdapterFromWalletClient` does not exist in the
 * installed @circle-fin/adapter-viem-v2@1.13.0 (only `createViemAdapterFromPrivateKey`,
 * server-side and wrong here, and `createViemAdapterFromProvider`). It also assumed a
 * single wagmi `useWalletClient()` would be enough, which works for Transfer's
 * single-chain sends but NOT for Bridge: a browser wallet only has one "current" chain
 * at a time, and `kit.bridge()` needs ONE adapter capable of signing on BOTH the source
 * and destination chain (Circle's own docs: "create ONE adapter that can work across
 * chains"). So this builds the adapter from the connected connector's raw EIP-1193
 * provider instead (`connector.getProvider()`) — still 100% wallet-driven, never a key —
 * and constructs a fresh per-chain viem WalletClient on demand via the adapter's
 * `getWalletClient({ chain })` getter, which is how the adapter can prompt the wallet to
 * switch networks itself when a step executes on a chain the wallet isn't currently on.
 *
 * Rebuilt (new adapter instance) whenever the connected address, chain, or connector
 * changes, per the critical rule: an adapter built before a chain switch must never be
 * reused as if it still reflects the old chain.
 */
export function useEvmAdapter() {
  const { address, chainId, isConnected, connector } = useAccount()
  const [adapter, setAdapter] = useState<ViemAdapter | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address || !chainId || !connector) {
      setAdapter(null)
      setError(null)
      return
    }

    let cancelled = false
    // Narrowed once into its own const — TS doesn't carry the guard clause's narrowing of
    // `connector` (possibly undefined) into the nested function declaration below.
    const activeConnector = connector

    // `connector.getProvider()` is a call, not just a promise chain — if `connector.getProvider`
    // isn't actually a function, the property access itself throws synchronously, before any
    // promise exists to `.catch()`. That throw happens inside this effect, outside React's render
    // phase, so nothing swallows it — it propagates straight to the nearest error boundary and
    // takes the whole component down. Confirmed via logging that this specifically hits
    // RainbowKit's `metaMaskWallet` connector (id="metaMaskSDK", type="metaMask") — RainbowKit
    // builds it by spreading wagmi's raw `metaMask()` connector into a new plain object
    // (`{ ...metamaskConnector, ...walletDetails, getChainId }` in
    // @rainbow-me/rainbowkit's metaMaskWallet chunk), and wagmi's own `createConnector` is a bare
    // identity function — neither layer explains why `getProvider` wouldn't survive that spread as
    // a plain closure-based method. Rather than keep tracing wagmi/RainbowKit internals blind, this
    // falls back to `window.ethereum` directly whenever `getProvider` isn't callable: MetaMask's
    // browser extension always injects it, and it's the same standard EIP-1193 provider the SDK's
    // own `getProvider()` would resolve to in the injected/extension case anyway.
    async function resolveProvider(): Promise<EIP1193Provider> {
      if (typeof activeConnector.getProvider === 'function') {
        return (await activeConnector.getProvider()) as EIP1193Provider
      }
      const injected = (window as { ethereum?: EIP1193Provider }).ethereum
      if (injected) {
        console.error(
          `[useEvmAdapter] connector.getProvider is not a function for connector id="${activeConnector.id}" name="${activeConnector.name}" type="${activeConnector.type}" — falling back to window.ethereum.`,
        )
        return injected
      }
      throw new Error(
        `connector.getProvider is not a function and no window.ethereum fallback is available (connector id="${activeConnector.id}").`,
      )
    }

    resolveProvider()
      .then((provider) => {
        if (cancelled) return

        setAdapter(
          new ViemAdapter(
            {
              // `chain` here is the SDK's OWN internally-resolved viem chain object (see
              // getViemChainByEnum in @circle-fin/adapter-viem-v2), not anything from this app's
              // own evmChains config — so `http()` with no URL would silently fall back to the
              // public default RPC even when VITE_*_RPC_URL overrides are set, regardless of
              // chain switching or balance-hook fixes elsewhere. Passing the URL explicitly,
              // keyed by chain id, is what actually makes the override reach Bridge Kit's
              // approve/burn/mint simulate + gas-estimate calls.
              getPublicClient: ({ chain }) => createPublicClient({ chain, transport: http(RPC_URL_BY_CHAIN_ID[chain.id]) }),
              // Bridge Kit and Swap Kit call `sendTransaction` on this client directly, with no
              // fee fields set — neither SDK's public API (BridgeParams / SwapKit's swap config)
              // exposes a gas-override hook, so this is the one place both funnel through. Same
              // fix as gasFees.ts (freshly-fetched baseFee, buffered 1.5x), applied here instead
              // of at the SDK call site since there is no call site to patch.
              getWalletClient: ({ chain }) => {
                const walletClient = createWalletClient({ account: address as `0x${string}`, chain, transport: custom(provider) })
                const feePublicClient = createPublicClient({ chain, transport: http(RPC_URL_BY_CHAIN_ID[chain.id]) })
                return walletClient.extend((client) => ({
                  // `args` is intentionally loosely typed here: viem's `sendTransaction` generics
                  // (const type params keyed off the request's discriminated `type` field) don't
                  // survive re-wrapping through `.extend()`, and this override only ever adds two
                  // optional bigint fee fields — it never changes the request shape otherwise.
                  async sendTransaction(args: Record<string, unknown>) {
                    let fees: Partial<import('../lib/gasFees').BufferedFees> = {}
                    if (args.maxFeePerGas === undefined && args.gasPrice === undefined) {
                      const block = await feePublicClient.getBlock()
                      if (block.baseFeePerGas !== null) {
                        fees = computeBufferedFees(block.baseFeePerGas)
                      }
                    }
                    return viemSendTransaction(client, { ...args, ...fees } as Parameters<typeof viemSendTransaction>[1])
                  },
                }))
              },
            },
            {
              addressContext: 'user-controlled',
              supportedChains: BRIDGE_SUPPORTED_EVM_CHAINS,
            },
          ),
        )
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error(
          `[useEvmAdapter] failed to resolve an EVM provider for connector id="${connector.id}" name="${connector.name}" type="${connector.type}":`,
          err,
        )
        setAdapter(null)
        setError(`Wallet connector "${connector.name}" doesn't support this action — try reconnecting or a different wallet.`)
      })

    return () => {
      cancelled = true
    }
  }, [address, chainId, isConnected, connector])

  return { adapter, error }
}
