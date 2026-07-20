import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BaseError, encodeFunctionData, erc20Abi, formatEther, isAddress, parseUnits } from 'viem'
import { estimateFeesPerGas, estimateGas, waitForTransactionReceipt } from '@wagmi/core'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import { CHAINS, EVM_CHAIN_LIST, type ChainId } from '../../assets/chains'
import AuthStatusBanner from '../../components/console/AuthStatusBanner'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import Modal from '../../components/console/Modal'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonBlock } from '../../components/console/Skeleton'
import { USDC_BY_CHAIN } from '../../config/tokens'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { useAddressBook } from '../../hooks/useAddressBook'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import { logTransfer } from '../../lib/activityLogWrites'
import { getExplorerTxUrl } from '../../lib/explorer'
import { getBufferedFees } from '../../lib/gasFees'
import { addressError, amountError } from '../../lib/validation'

const FALLBACK_BALANCE = 0
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const TOKENS = [
  { value: 'USDC', label: 'USDC', sublabel: 'USD Coin (Circle)' },
  { value: 'USDT', label: 'USDT', sublabel: 'Tether USD' },
]
const CHAIN_OPTIONS = EVM_CHAIN_LIST.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: c.layer,
  icon: <c.Icon className="w-6 h-6 shrink-0" />,
}))

function TransferForm() {
  const loading = useSimulatedLoading()
  const [chainId, setChainId] = useState<ChainId>('ethereum')
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [token, setToken] = useState('USDC')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sent, setSent] = useState(false)
  const [addressBookOpen, setAddressBookOpen] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const [sentTxHash, setSentTxHash] = useState<string | null>(null)
  const [sentExplorerUrl, setSentExplorerUrl] = useState<string | undefined>(undefined)
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null)

  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { contacts, isLoading: contactsLoading } = useAddressBook(isAuthenticated ? walletAddress : undefined)
  const { writeContractAsync } = useWriteContract()
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()

  const chain = CHAINS[chainId]
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const needsChainSwitch = !isOnChain(chain.evmChainId!)

  const selectChain = (id: ChainId) => {
    setChainId(id)
    ensureChain(CHAINS[id].evmChainId!)
  }

  const usdcBalance = useTokenBalance(chain.evmChainId!)
  const isUsdc = token === 'USDC'
  const availableBalance = isUsdc ? Number(usdcBalance.formatted) : FALLBACK_BALANCE
  const balanceLoading = isUsdc ? usdcBalance.isLoading : loading

  // While the real USDC balance is still loading, availableBalance is a placeholder 0 —
  // validating against it would flash a false "exceeds available balance" error before the RPC
  // call resolves (same race condition fixed in Swap/Liquidity).
  const amountMsg = useMemo(() => {
    if (isUsdc && balanceLoading) return null
    return amountError(amount, availableBalance)
  }, [amount, availableBalance, isUsdc, balanceLoading])
  const addressMsg = useMemo(() => {
    const baseMsg = addressError(address)
    if (baseMsg) return baseMsg
    // addressError's format check accepts ENS names, but this app doesn't resolve them — without
    // this, a well-formed ENS name passes validation, the review modal opens, and the send only
    // fails deep inside handleConfirm after the user has already committed to it.
    if (!isAddress(address)) return 'ENS resolution is not supported on these testnets — enter a 0x address.'
    if (address.toLowerCase() === ZERO_ADDRESS) return 'Cannot send to the zero address — funds would be unrecoverable.'
    return null
  }, [address])
  // USDT has no real ERC-20 contract configured (see src/config/tokens.ts) — block real submission
  // rather than silently sending against the wrong contract.
  const tokenUnsupportedMsg = !isUsdc ? 'USDT transfers are not wired to a real contract yet — select USDC.' : null
  const isValid = !amountMsg && !addressMsg && !needsChainSwitch && !tokenUnsupportedMsg

  // Best-effort gas estimate for the review modal — never blocks submission if it fails.
  useEffect(() => {
    if (!reviewOpen || !isValid || !walletAddress || !chain.evmChainId) {
      setEstimatedFee(null)
      return
    }
    const usdc = USDC_BY_CHAIN[chain.evmChainId]
    if (!usdc || !isAddress(address)) {
      setEstimatedFee(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [address as `0x${string}`, parseUnits(amount || '0', usdc.decimals)],
        })
        const [gas, fees] = await Promise.all([
          estimateGas(wagmiConfig, {
            account: walletAddress as `0x${string}`,
            to: usdc.address,
            data,
            chainId: chain.evmChainId,
          }),
          estimateFeesPerGas(wagmiConfig, { chainId: chain.evmChainId }),
        ])
        if (!cancelled) {
          const feeWei = gas * fees.maxFeePerGas
          setEstimatedFee(`~${Number(formatEther(feeWei)).toFixed(6)} ${chain.shortLabel.split(' ')[0]}`)
        }
      } catch {
        if (!cancelled) setEstimatedFee(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reviewOpen, isValid, walletAddress, chain.evmChainId, chain.shortLabel, address, amount, wagmiConfig])

  const handleConfirm = async () => {
    // React's state updates aren't synchronous — the review modal's confirm button doesn't
    // actually become `disabled` until the next render, so a fast double-click (or double-tap on
    // touch) can invoke this a second time while the first submission is still in flight. This
    // guard is the actual re-entrancy check; the disabled button is only a visual backstop.
    if (confirming) return
    setTxError(null)
    setConfirming(true)
    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!chain.evmChainId) throw new Error('Unsupported chain.')
      if (!isOnChain(chain.evmChainId)) {
        throw new Error('Your wallet switched networks — switch back and try again.')
      }
      if (!isAddress(address)) {
        throw new Error('Enter a valid 0x address — ENS resolution is not supported on these testnets.')
      }
      const usdc = USDC_BY_CHAIN[chain.evmChainId]
      if (!usdc) throw new Error('USDC is not configured on this chain.')

      const parsedAmount = parseUnits(amount, usdc.decimals)
      // Explicit, freshly-fetched fee override — viem's sendTransaction never estimates fees
      // itself for a browser-wallet ("json-rpc") account, so without this the wallet's own
      // possibly-stale suggestion is what actually gets sent (see gasFees.ts for the full trace;
      // this is the same class of "max fee per gas less than block base fee" gap found on
      // Arbitrum Sepolia while wiring up Aave).
      const fees = await getBufferedFees(wagmiConfig, chain.evmChainId)
      const hash = await writeContractAsync({
        chainId: chain.evmChainId,
        address: usdc.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [address as `0x${string}`, parsedAmount],
        ...fees,
      })

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: chain.evmChainId })
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.')

      // The sender's balance just changed on-chain — refetch this page's own balance display
      // immediately rather than waiting for the poll interval, and invalidate the aggregate
      // cache useUsdcBalances (Overview/Unified Balance) reads from.
      void usdcBalance.refetch()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(chain.evmChainId, walletAddress) })

      const explorerUrl = getExplorerTxUrl(chain.evmChainId, hash)

      // Own try/catch: the transfer already succeeded on-chain at this point, so a Firestore
      // write failure (e.g. sign-in hadn't finished yet) must never surface as "Transfer failed."
      try {
        await logTransfer(walletAddress, {
          txHash: hash,
          amount: Number(amount),
          token,
          chain: chain.name,
          counterparty: address,
          explorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist transfer to Firestore:', logErr)
      }

      setSentTxHash(hash)
      setSentExplorerUrl(explorerUrl)
      setSent(true)
      setReviewOpen(false)
      setAmount('')
      setAddress('')
      setTouched(false)
    } catch (err) {
      // viem/wagmi errors are BaseError instances whose .message is a long multi-paragraph dump
      // (docs links, contract call details, etc.) — .shortMessage is the one-line summary meant
      // for exactly this kind of display. Plain errors (the explicit throws above) fall back to
      // .message, which is already a short, direct string.
      const message = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : 'Transfer failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setTxError(rejected ? 'Transfer cancelled — the wallet request was rejected.' : message)
      setReviewOpen(false)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="text-center page-header items-center">
        <h2 className="page-title text-headline-lg">Transfer Assets</h2>
        <p className="page-subtitle">Securely move assets between institutional vaults</p>
      </div>

      <AuthStatusBanner />

      {sent && (
        <div className="banner-success animate-fade-in-up">
          <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
          <div className="min-w-0">
            <p className="text-body-sm text-green-400 font-medium">Transfer confirmed on-chain.</p>
            {sentTxHash && (
              <p className="text-[11px] font-mono-data text-green-400/60 truncate">{sentTxHash}</p>
            )}
            {sentExplorerUrl && (
              <a
                href={sentExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-green-400/80 underline underline-offset-2 hover:text-green-400"
              >
                View transaction on explorer
              </a>
            )}
          </div>
        </div>
      )}

      {txError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">{txError}</p>
        </div>
      )}

      <div className="form-stack">
        <div className="panel p-6">
          <div className="flex justify-between items-center mb-4">
            <span className="field-label">From Chain</span>
            <Dropdown
              value={chainId}
              onChange={(v) => selectChain(v as ChainId)}
              options={CHAIN_OPTIONS}
              ariaLabel="Select source chain"
              triggerClassName="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected, open) => (
                <>
                  <chain.Icon className="w-5 h-5 shrink-0" />
                  <span className="font-bold text-on-surface text-sm">{selected?.label}</span>
                  <span
                    className={`material-symbols-outlined text-on-surface-variant text-[16px] transition-transform ${open ? 'rotate-180' : ''}`}
                  >
                    expand_more
                  </span>
                </>
              )}
            />
          </div>
          <div className="flex justify-between items-center mb-4">
            <label htmlFor="transfer-amount" className="field-label">
              Amount to send
            </label>
            {balanceLoading ? (
              <SkeletonBlock className="h-4 w-28" />
            ) : (
              <span className="text-body-sm text-on-surface-variant/65 font-mono-data">
                Balance: <span className="text-on-surface">{availableBalance.toFixed(2)} {token}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <input
              id="transfer-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="decimal"
              className="input-amount text-[40px] font-headline-lg"
              placeholder="0.00"
              type="text"
            />
            <MaxButton onClick={() => setAmount(String(availableBalance))} />
            <Dropdown
              value={token}
              onChange={setToken}
              options={TOKENS}
              ariaLabel="Select token"
              triggerClassName="bg-white/[0.04] border border-white/10 flex items-center gap-2 px-3 py-2 rounded-xl transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected, open) => (
                <>
                  <div className="w-6 h-6 rounded-full bg-tertiary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-sm">monetization_on</span>
                  </div>
                  <span className="font-bold text-on-surface text-sm">{selected?.label}</span>
                  <span
                    className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ease-premium ${open ? 'rotate-180' : ''}`}
                  >
                    keyboard_arrow_down
                  </span>
                </>
              )}
            />
          </div>
          {touched && <FieldError message={amountMsg ?? tokenUnsupportedMsg} />}
        </div>

        <div className="form-connector">
          <div className="form-connector-btn pointer-events-none" aria-hidden>
            <span className="material-symbols-outlined text-[20px]">south</span>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex justify-between items-center mb-4">
            <label htmlFor="transfer-address" className="field-label">
              Recipient address
            </label>
            <button
              type="button"
              onClick={() => setAddressBookOpen(true)}
              className="text-primary text-[12px] font-bold tracking-tight hover:text-primary/80 transition-premium"
            >
              Address Book
            </button>
          </div>
          <input
            id="transfer-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => setTouched(true)}
            className="input-amount text-[18px] font-body-md tracking-tight"
            placeholder="Enter ENS or 0x address..."
            type="text"
          />
          {touched && <FieldError message={addressMsg} />}
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <span className="material-symbols-outlined text-primary text-sm shrink-0">info</span>
            <p className="text-[12px] text-on-surface-variant/75 leading-relaxed">
              Recipient must be a whitelisted institutional counterparty.
            </p>
          </div>
        </div>
      </div>

      {needsChainSwitch && (
        <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
            <p className="text-body-sm text-tertiary font-medium">
              Your wallet is on a different network — switch to {chain.shortLabel} to continue
            </p>
          </div>
          <button
            type="button"
            onClick={() => ensureChain(chain.evmChainId!)}
            disabled={switchPending}
            className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {switchPending ? 'Switching…' : `Switch to ${chain.shortLabel}`}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setTouched(true)
          if (isValid) setReviewOpen(true)
        }}
        disabled={!isValid}
        className="btn-primary w-full py-5 rounded-2xl text-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <span>Confirm Transfer</span>
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>

      <div className="glass-premium rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center text-body-sm">
          <div className="flex items-center gap-2 text-on-surface-variant/70">
            <span className="material-symbols-outlined text-sm">gas_meter</span>
            <span>Estimated Network Fee</span>
          </div>
          <span className="font-mono-data data-muted">—</span>
        </div>
        <div className="flex justify-between items-center text-body-sm">
          <div className="flex items-center gap-2 text-on-surface-variant/70">
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span>Finality Time</span>
          </div>
          <span className="font-mono-data data-muted">—</span>
        </div>
        <div className="pt-4 border-t border-white/[0.06] flex justify-between items-center text-body-sm">
          <div className="flex items-center gap-2 text-on-surface-variant/70">
            <span className="material-symbols-outlined text-sm">security</span>
            <span>Security Audit</span>
          </div>
          <span className="flex items-center gap-1 data-muted">
            <span className="material-symbols-outlined text-sm">pending</span>
            <span className="font-mono-data">Pending</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass card-interactive rounded-2xl p-5 flex flex-col justify-between h-28">
          <div className="flex items-center gap-2 field-label">
            <span className="material-symbols-outlined text-sm">history</span>
            <span>Last Sent</span>
          </div>
          <div className="text-body-sm text-on-surface-variant/70">No transfers yet</div>
        </div>
        <div className="glass card-interactive rounded-2xl p-5 flex flex-col justify-between h-28">
          <div className="flex items-center gap-2 field-label">
            <span className="material-symbols-outlined text-sm">auto_graph</span>
            <span>Volume Cap</span>
          </div>
          <div className="text-body-sm text-on-surface-variant/70">Not configured</div>
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleConfirm}
        confirming={confirming}
        title="Review Transfer"
        confirmLabel="Send Transfer"
        rows={[
          { label: 'Amount', value: `${amount || '0.00'} ${token}`, accent: true },
          { label: 'Chain', value: chain.name },
          { label: 'Recipient', value: address || '—' },
          { label: 'Est. Network Fee', value: estimatedFee ?? '—' },
        ]}
      />

      <Modal open={addressBookOpen} onClose={() => setAddressBookOpen(false)} title="Address Book">
        {contactsLoading ? (
          <div className="space-y-3">
            <SkeletonBlock className="h-14 w-full" />
            <SkeletonBlock className="h-14 w-full" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-10 empty-state">
            <div className="empty-state-icon w-14 h-14">
              <span className="material-symbols-outlined text-[22px]">contacts</span>
            </div>
            <p className="empty-state-title">No saved contacts</p>
            <p className="empty-state-desc">Contacts you save will appear here for quick reuse.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04] -mx-6">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  setAddress(contact.address)
                  setAddressBookOpen(false)
                }}
                className="table-row w-full flex items-center justify-between px-6 py-4 text-left transition-premium hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <p className="font-bold tracking-tight text-sm truncate">{contact.name}</p>
                  <p className="text-[12px] text-on-surface-variant/55 mt-0.5 truncate font-mono-data">
                    {contact.address}
                  </p>
                </div>
                {contact.chain && (
                  <span className="font-mono-data text-[11px] data-muted shrink-0 ml-4">{contact.chain}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function Transfer() {
  return (
    <RequireWallet noun="your transfer activity">
      <TransferForm />
    </RequireWallet>
  )
}
