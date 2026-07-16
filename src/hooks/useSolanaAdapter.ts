// The classic (non-`/next`) `createSolanaKitAdapterFromProvider` builds a fee-payer signer that
// only implements `signAndSendTransactions` (`TransactionSendingSigner`). Bridge Kit's own
// `executeTransaction` calls `@solana/kit`'s `partiallySignTransactionMessageWithSigners`, which
// explicitly excludes `TransactionSendingSigner`s (`identifySendingSigner: false`) since that
// interface is only usable via `signAndSendTransactionMessageWithSigners`. The fee payer's signer
// is therefore silently dropped, no signature ever gets attached, and Solana's own
// `getSignatureFromTransaction` throws SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING —
// "Could not determine this transaction's signature... signed by its fee payer." The `/next`
// entrypoint's `createSolanaKitAdapterFromProvider` fixes this: per its own docstring it "creates
// a TransactionPartialSigner wrapper for local signing" (confirmed in next.mjs — it builds
// `signTransactions`, not `signAndSendTransactions`), which `partiallySignTransactionMessageWithSigners`
// does recognize. Same `SolanaKitWalletProvider` shape, same `SolanaKitAdapter` return type — only
// the entrypoint and the now-real async factory (see the `await` below) differ from the classic API.
import { createSolanaKitAdapterFromProvider, type SolanaKitAdapter } from '@circle-fin/adapter-solana-kit/next'
import { SolanaDevnet } from '@circle-fin/bridge-kit/chains'
import { createSolanaRpc, devnet } from '@solana/kit'
import { useWallet, type WalletContextState } from '@solana/wallet-adapter-react'
import { SolanaSignTransaction } from '@solana/wallet-standard-features'
import { StandardWalletAdapter } from '@solana/wallet-standard-wallet-adapter-base'
import { Connection, VersionedTransaction } from '@solana/web3.js'
import { useEffect, useState } from 'react'
import { SOLANA_DEVNET_RPC } from '../context/SolanaWalletContext'

// `createSolanaKitAdapterFromProvider`'s `<const TCapabilities>` infers the capabilities object
// passed at the call site as deep-readonly literals, which doesn't structurally match the
// default (mutable-array) generic instantiation — hence the broader, unparameterized type here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SolanaAdapter = SolanaKitAdapter<any>

// One shared RPC client for every adapter instance — same endpoint SolanaWalletContext connects
// the wallet to, so both sides of the bridge (wallet UI and Circle's mint/burn execution) hit the
// same (ideally non-rate-limited) RPC rather than silently diverging. `devnet(...)` brands the URL
// (which may be an arbitrary provider URL, e.g. Helius, not literally containing "devnet") so
// `createSolanaRpc` returns the devnet-capable `Rpc<SolanaRpcApiDevnet>` the adapter's `getRpc`
// (typed for `SolanaRpcApiForTestClusters`) expects, rather than the generic mainnet-safe subset.
const solanaRpc = createSolanaRpc(devnet(SOLANA_DEVNET_RPC))

// CCTP's Solana burn instruction (depositForBurn, via the Anchor TokenMessengerMinter program)
// is built through `getAnchorProvider`, which is a COMPLETELY SEPARATE code path from
// `executeTransaction`'s `getRpc` above — it only respects an explicit `getConnection` override,
// and otherwise silently falls back to `chain.rpcEndpoints[0]` (SolanaDevnet's hardcoded
// `https://api.devnet.solana.com`). `getRpc` alone (the earlier fix, which unblocked the
// forwarder-routed mint) never touched this: mint's forwarder path skips client-side execution
// entirely, so it never exercised `getAnchorProvider`, while burn — which has no forwarder option
// and must build+simulate the real depositForBurn instruction locally — kept hitting the public,
// rate-limited endpoint regardless of VITE_SOLANA_RPC_URL. This is a real `@solana/web3.js`
// `Connection`, not a `@solana/kit` `Rpc` client — a different type from `solanaRpc` above.
const solanaConnection = new Connection(SOLANA_DEVNET_RPC, 'confirmed')

function isZeroSignature(sig: Uint8Array | null | undefined): boolean {
  return !sig || sig.every((byte) => byte === 0)
}

/**
 * DIAGNOSTIC — logs how many signers a burn (or any) transaction actually requires and which
 * signature slots are filled, both before and after the wallet signs. CCTP's Solana
 * depositForBurn creates an ephemeral "message account" keypair that's ALSO a required signer
 * alongside the fee payer (confirmed in adapter-solana-kit's buildDepositForBurnInstructions —
 * `.signers([messageAccount])`), so a multi-signer transaction here is expected, not a bug by
 * itself — this print is to confirm that empirically rather than assume it from reading code.
 */
function logSignatureState(label: string, tx: VersionedTransaction) {
  const requiredSigners = tx.message.header.numRequiredSignatures
  const accountKeys = tx.message.staticAccountKeys.map((k) => k.toBase58())
  const filled = tx.signatures.map((sig, i) => `${accountKeys[i] ?? `(index ${i})`}: ${isZeroSignature(sig) ? 'EMPTY' : 'FILLED'}`)
  console.error(`[useSolanaAdapter] ${label} — numRequiredSignatures=${requiredSigners}, signatures.length=${tx.signatures.length}`, filled)
}

/**
 * Extracts the {address: signatureBytes} map @solana/kit's `TransactionPartialSigner` contract
 * requires from a signed transaction. The fee payer is always the first required signer in a
 * compiled transaction, so `signatures[0]` is always its signature (same indexing the fee-payer
 * validation in adapter-solana-kit's own code uses against `staticAccountKeys[0]`).
 *
 * Only the fee payer's slot is extracted here deliberately, not the whole array: tracing
 * adapter-solana-kit's `createExecute` (next.mjs) shows the CCTP burn's OTHER required signer (the
 * ephemeral message account) is signed entirely separately, via `collectAdditionalSignatures`
 * using that keypair's own local secret key — it never goes through this wallet-backed signer at
 * all, and that call happens AFTER this one returns, merging its signature into the base
 * `signedTransaction.signatures` this function's caller starts from. So index 1+ in what the
 * *wallet* signs is expected to stay empty here regardless — the logging above is what actually
 * confirms that instead of just asserting it from reading source.
 */
function toSignatureDictionary(signed: VersionedTransaction, feePayerAddress: string) {
  const feePayerSignature = signed.signatures[0]
  if (isZeroSignature(feePayerSignature)) {
    throw new Error(
      'Wallet returned an empty signature for the fee payer — the transaction was not actually signed. See [useSolanaAdapter] logs above for the full signature state.',
    )
  }
  return { [feePayerAddress]: feePayerSignature }
}

/**
 * Signs raw, already-serialized transaction bytes via the Wallet Standard `solana:signTransaction`
 * feature directly — bypassing wallet-adapter-react's own `signTransaction`/`signAllTransactions`,
 * which round-trips through `@solana/web3.js`'s `VersionedTransaction.serialize()`/`.deserialize()`.
 * That round-trip turned out not to be the actual bug (ruled out empirically — see below), but going
 * through the wallet's raw bytes directly is still one less re-encoding step, so it's kept.
 *
 * Phantom's failure mode (fixed): confirmed via an ED25519 check comparing message bytes sent vs.
 * returned by the wallet. Circle's SDK never included a `ComputeBudgetProgram.setComputeUnitPrice`
 * (priority fee) instruction in any transaction it builds. Phantom detects an "unpriced" transaction
 * and silently injects its own priority-fee instruction before signing — explicitly permitted by the
 * Wallet Standard spec ("allows... wallets that use meta-transactions to return a modified, signed
 * transaction"). Circle's `createExecute` signs the fee payer and any additional signers (e.g. CCTP's
 * ephemeral message account) against two SEPARATE compiles of what's supposed to be the same message;
 * if the wallet changes the message while signing the fee payer's half, the cluster rejects the
 * transaction with "Transaction did not pass signature verification". Fixed via a local patch-package
 * patch on `@circle-fin/adapter-solana-kit` that always includes a priority-fee instruction, so the
 * wallet never has a reason to modify anything for this reason (see patches/ in the repo root).
 *
 * Solflare's failure mode (KNOWN, UNRESOLVED): Solflare still returns an invalid signature for
 * Solana-source burns even with the priority-fee instruction present. Diffing the exact message bytes
 * sent vs. returned (byte-for-byte) showed Solflare reorders the static account-key list itself —
 * unrelated to priority fees. CCTP's `depositForBurn` instruction references several accounts more
 * than once, and Solflare's raw-signing path appears to decode+recompile the account list with
 * different dedup/ordering logic than `@solana/kit` used, rather than signing the literal bytes
 * handed to it. Same structural problem as above (a wallet-reordered message can't be reconciled with
 * a signature Circle's ephemeral signer already computed against the original order), but there's no
 * equivalent "always include X" workaround available for account ordering — this looks like it needs
 * a fix on Solflare's side. The UI surfaces a warning for this combination (see Bridge.tsx).
 */
async function signRawTransactionsViaWalletStandard(
  wallet: WalletContextState,
  feePayerAddress: string,
  rawTransactions: Uint8Array[],
): Promise<Uint8Array[]> {
  const adapter = wallet.wallet?.adapter
  if (!(adapter instanceof StandardWalletAdapter)) {
    throw new Error('Connected wallet is not registered as a Wallet Standard wallet; raw-byte signing is unavailable.')
  }
  const standardWallet = adapter.wallet
  if (!(SolanaSignTransaction in standardWallet.features)) {
    throw new Error(`${standardWallet.name} does not support the solana:signTransaction feature.`)
  }
  const account = standardWallet.accounts.find((a) => a.address === feePayerAddress)
  if (!account) {
    throw new Error(`No connected Wallet Standard account matches fee payer ${feePayerAddress}.`)
  }
  const outputs = await standardWallet.features[SolanaSignTransaction].signTransaction(
    ...rawTransactions.map((transaction) => ({ account, transaction })),
  )
  return outputs.map((output) => output.signedTransaction)
}

/**
 * Wallet-adapter-react's connected wallet doesn't natively implement
 * @circle-fin/adapter-solana-kit's `SolanaKitWalletProvider` shape (it uses `publicKey`/
 * `connect(): Promise<void>` rather than `address`/`connect(): Promise<{ address }>`), so this
 * shims one onto the other rather than fabricating a different Circle API. The wallet is
 * already connected via wallet-adapter-react's own modal by the time this is used, so `connect`
 * here just re-confirms the existing session instead of prompting again.
 *
 * `signTransaction`/`signAllTransactions` sign the raw wire bytes Circle's SDK hands us
 * (`wireTx = getBase64EncodedWireTransaction(tx)`, confirmed in next.mjs) via
 * `signRawTransactionsViaWalletStandard` above rather than wallet-adapter-react's own signing
 * methods — see that function's docblock for why. `VersionedTransaction.deserialize` is still used
 * here, but only as a pure read (never followed by `.serialize()`): once before signing, purely to
 * log signature state, and once after, purely to pull `signatures[0]` back out into the
 * `{ [address]: Uint8Array(64) }` shape `@solana/kit`'s `signModifyingAndPartialTransactionSigners`
 * requires (confirmed in @solana/kit's own source — it destructures `signTransactions`' return
 * value as `[signatureDictionary]` and spreads it directly into the transaction's `signatures` map).
 */
function toSolanaKitProvider(wallet: WalletContextState) {
  const { publicKey, signTransaction, signMessage, disconnect } = wallet
  const isStandardWallet = wallet.wallet?.adapter instanceof StandardWalletAdapter
  if (!publicKey || !signTransaction || !isStandardWallet) return null
  const feePayerAddress = publicKey.toBase58()

  return {
    isConnected: true,
    address: feePayerAddress,
    connect: async () => ({ address: feePayerAddress }),
    disconnect: () => disconnect(),
    signTransaction: async (wireTransaction: unknown) => {
      const rawBytes = new Uint8Array(Buffer.from(wireTransaction as string, 'base64'))
      logSignatureState('signTransaction — before wallet signs', VersionedTransaction.deserialize(rawBytes))
      const [signedBytes] = await signRawTransactionsViaWalletStandard(wallet, feePayerAddress, [rawBytes])
      const signed = VersionedTransaction.deserialize(signedBytes)
      logSignatureState('signTransaction — after wallet signs', signed)
      return toSignatureDictionary(signed, feePayerAddress)
    },
    signAllTransactions: async (wireTransactions: unknown[]) => {
      const rawBytesList = wireTransactions.map((wireTx) => new Uint8Array(Buffer.from(wireTx as string, 'base64')))
      rawBytesList.forEach((bytes, i) =>
        logSignatureState(`signAllTransactions[${i}] — before wallet signs`, VersionedTransaction.deserialize(bytes)),
      )
      const signedBytesList = await signRawTransactionsViaWalletStandard(wallet, feePayerAddress, rawBytesList)
      const signedTxs = signedBytesList.map((bytes) => VersionedTransaction.deserialize(bytes))
      signedTxs.forEach((tx, i) => logSignatureState(`signAllTransactions[${i}] — after wallet signs`, tx))
      return signedTxs.map((tx) => toSignatureDictionary(tx, feePayerAddress))
    },
    ...(signMessage && {
      signMessage: async (message: Uint8Array) => ({ signature: await signMessage(message) }),
    }),
  }
}

/**
 * Real Circle Solana adapter, built from whichever wallet wallet-adapter-react currently has
 * connected. Rebuilds on every real connect/disconnect/account-change event — same discipline
 * as useEvmAdapter's rebuild-on-chain-switch rule, since a stale adapter must never be reused
 * against a different signer.
 */
export function useSolanaAdapter(): SolanaAdapter | null {
  const wallet = useWallet()
  const [adapter, setAdapter] = useState<SolanaAdapter | null>(null)

  useEffect(() => {
    const provider = toSolanaKitProvider(wallet)
    if (!provider) {
      setAdapter(null)
      return
    }

    let cancelled = false
    createSolanaKitAdapterFromProvider({
      provider,
      getRpc: () => solanaRpc,
      getConnection: () => solanaConnection,
      capabilities: { addressContext: 'user-controlled', supportedChains: [SolanaDevnet] },
    }).then((created) => {
      if (!cancelled) setAdapter(created)
    })
    return () => {
      cancelled = true
    }
  }, [wallet])

  return adapter
}
