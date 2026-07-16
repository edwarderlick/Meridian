import { useAccount, useSwitchChain } from 'wagmi'

/**
 * Requests a real wallet network switch to an EVM chain. Discipline for
 * later phases: any adapter or contract-interaction hook built on top of a
 * chain selection must be re-created only after `isOnChain` is confirmed
 * true for the target chain post-switch — never reuse an adapter instance
 * that was built against the previous network. No such adapters exist yet
 * in this phase (connection only); this hook just establishes the pattern.
 */
export function useEvmChainSwitch() {
  const { chainId: connectedChainId, isConnected } = useAccount()
  const { switchChain, isPending, error } = useSwitchChain()

  const isOnChain = (targetChainId: number) => isConnected && connectedChainId === targetChainId

  const ensureChain = (targetChainId: number) => {
    if (!isConnected || isOnChain(targetChainId)) return
    switchChain({ chainId: targetChainId })
  }

  return { connectedChainId, isOnChain, ensureChain, isPending, error }
}
