import type { BridgeResult } from '@circle-fin/bridge-kit'

/**
 * Extracted out of Bridge.tsx so Liquidity's deposit flow can drive the exact same Bridge Kit
 * step vocabulary/display logic instead of reimplementing it — Bridge.tsx now imports these too.
 */
export type StepBucket = 'approve' | 'burn' | 'attest' | 'mint'

export const STEP_META: { bucket: StepBucket; label: string; icon: string }[] = [
  { bucket: 'approve', label: 'Approve', icon: 'task_alt' },
  { bucket: 'burn', label: 'Burn', icon: 'local_fire_department' },
  { bucket: 'attest', label: 'Attest', icon: 'verified' },
  { bucket: 'mint', label: 'Mint', icon: 'token' },
]

export interface StepDisplay {
  state: 'idle' | 'pending' | 'success' | 'error'
  txHash?: string
  explorerUrl?: string
  errorMessage?: string
}

export const IDLE_STEPS: Record<StepBucket, StepDisplay> = {
  approve: { state: 'idle' },
  burn: { state: 'idle' },
  attest: { state: 'idle' },
  mint: { state: 'idle' },
}

/**
 * Bridge Kit's live events use method names 'approve' | 'burn' | 'fetchAttestation' | 'mint' | 'reAttest'
 * (confirmed against @circle-fin/provider-cctp-v2's CCTPV2Actions type) — matched case-insensitively by
 * substring so 'reAttest' folds into the same 'attest' bucket as 'fetchAttestation'.
 */
export function normalizeStepName(name: string): StepBucket | null {
  const n = name.toLowerCase()
  if (n.includes('approve')) return 'approve'
  if (n.includes('burn')) return 'burn'
  if (n.includes('attest')) return 'attest'
  if (n.includes('mint')) return 'mint'
  return null
}

export function stepsFromResult(result: BridgeResult): Record<StepBucket, StepDisplay> {
  const next: Record<StepBucket, StepDisplay> = { ...IDLE_STEPS }
  for (const step of result.steps) {
    const bucket = normalizeStepName(step.name)
    if (!bucket) continue
    next[bucket] = {
      state: step.state === 'noop' ? 'success' : step.state,
      txHash: step.txHash,
      explorerUrl: step.explorerUrl,
      errorMessage: step.errorMessage,
    }
  }
  return next
}
