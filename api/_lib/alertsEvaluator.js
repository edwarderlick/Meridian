// Server-side alert + recurring-payment-due evaluator. Runs read-only against live chain state
// and the real Firestore activity log — never signs or submits any transaction (Meridian holds no
// signing key), so it can only ever produce data, never move funds. See RecurringPayments.tsx's
// docblock for why fully-automatic execution is a separate, not-yet-made decision.
//
// This file is a plain-JS Node module (not a Vite-bundled `src/` file) so it can run both as a
// Vercel serverless function and directly under the local Express dev server with no build step —
// same reason every other api/_lib/*.js file is plain JS. Real npm packages (viem, viem/chains,
// @bgd-labs/aave-address-book) are imported directly, so Aave pool/USDC addresses for chains viem
// already knows about can never drift from the frontend's own aaveClient.ts, which sources them
// from the exact same package. Arc Testnet (not in viem/chains) and the flat USDC-per-chain map are
// hand-copied from src/config/chains.ts / src/config/tokens.ts — small, rarely-changed values, kept
// in sync manually; if either of those two frontend files changes its addresses, update here too.

import { createPublicClient, http, erc20Abi } from 'viem'
import { arbitrumSepolia, avalancheFuji, baseSepolia, optimismSepolia, polygonAmoy, sepolia } from 'viem/chains'
import { AaveV3ArbitrumSepolia, AaveV3OptimismSepolia } from '@bgd-labs/aave-address-book'
import { getAdminFirestore } from './firebaseAdmin.js'

const arcTestnet = { id: 5042002, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }

// Mirrors src/config/tokens.ts's USDC_BY_CHAIN.
const USDC_BY_CHAIN = {
  [arcTestnet.id]: '0x3600000000000000000000000000000000000000',
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [optimismSepolia.id]: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  [avalancheFuji.id]: '0x5425890298aed601595a70AB815c96711a31Bc65',
  [polygonAmoy.id]: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
}

// Mirrors src/lib/aaveClient.ts's AAVE_MARKET_BY_EVM_CHAIN_ID — same package, same addresses.
const AAVE_MARKET_BY_CHAIN = {
  [arbitrumSepolia.id]: { pool: AaveV3ArbitrumSepolia.POOL, usdc: AaveV3ArbitrumSepolia.ASSETS.USDC.UNDERLYING },
  [optimismSepolia.id]: { pool: AaveV3OptimismSepolia.POOL, usdc: AaveV3OptimismSepolia.ASSETS.USDC.UNDERLYING },
}

const CHAIN_BY_ID = {
  [arcTestnet.id]: arcTestnet,
  [sepolia.id]: sepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [baseSepolia.id]: baseSepolia,
  [optimismSepolia.id]: optimismSepolia,
  [avalancheFuji.id]: avalancheFuji,
  [polygonAmoy.id]: polygonAmoy,
}

const RAY = 10n ** 27n
const RESERVE_DATA_ABI = [
  {
    name: 'getReserveData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { type: 'tuple', components: [
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
      ] },
    ],
  },
]

function publicClientFor(chainId) {
  const chain = CHAIN_BY_ID[chainId]
  if (!chain) return null
  return createPublicClient({ chain, transport: http() })
}

// ArcYieldPool is Meridian's OWN contract (contracts/contracts/ArcYieldPool.sol) — not a secret, so
// it's fine to read the same VITE_-prefixed env var the frontend uses (src/lib/arcYieldPoolClient.ts)
// rather than duplicate the address under a second name that could drift. Undefined until deployed.
const ARC_YIELD_POOL_ADDRESS = process.env.VITE_ARC_YIELD_POOL_ADDRESS || undefined
const UINT256_MAX = (1n << 256n) - 1n
const POOL_HEALTH_ABI = [
  {
    name: 'getPoolHealth',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalDeposits', type: 'uint256' },
      { name: 'reserve', type: 'uint256' },
      { name: 'projectedAnnualObligation', type: 'uint256' },
      { name: 'reserveCoverageBps', type: 'uint256' },
      { name: 'estimatedRunwaySeconds', type: 'uint256' },
    ],
  },
]

/** Re-triggering the same continuous condition (low balance, low APY) every cron tick would spam
 *  the user — only re-alert once the condition has been true for at least this long since the
 *  last time it fired. */
const RETRIGGER_COOLDOWN_MS = 6 * 60 * 60 * 1000
/** How far back "Large Transfer" looks for new transfers on a rule's very first evaluation
 *  (before it has a real lastCheckedAt cursor of its own). */
const FIRST_RUN_LOOKBACK_MS = 60 * 60 * 1000

const OUTFLOW_CATEGORY_BY_TYPE = {
  transfer: 'Transfer',
  bridge: 'Bridge',
  swap: 'Swap',
  gateway_deposit: 'Gateway Deposit',
  gateway_withdraw: 'Gateway Spend',
  aave_deposit: 'Yield Deposit',
  uniswap_deposit: 'Yield Deposit',
}

/** Same classification rules as src/hooks/useSpendingAnalytics.ts's toOutflowRow — duplicated here
 *  (not imported) because this is a plain-JS backend module, separate from the Vite-bundled
 *  frontend; keep the two in sync if the outflow definition ever changes. */
function outflowAmountUsdc(entry) {
  if (!OUTFLOW_CATEGORY_BY_TYPE[entry.type]) return null
  if (entry.type === 'bridge' && entry.status !== 'success') return null
  if (entry.type === 'gateway_deposit' && entry.status !== 'finalized') return null

  if (entry.type === 'uniswap_deposit') {
    const amount = entry.token0Symbol === 'USDC' ? Number(entry.amount0) : entry.token1Symbol === 'USDC' ? Number(entry.amount1) : 0
    return Number.isFinite(amount) ? amount : 0
  }
  const isUsdc = entry.token === undefined || entry.token === 'USDC'
  const amount = Number(entry.amount)
  return isUsdc && Number.isFinite(amount) ? amount : 0
}

async function evaluateLowBalance(wallet, rule) {
  const client = publicClientFor(rule.chainId)
  const usdc = USDC_BY_CHAIN[rule.chainId]
  if (!client || !usdc) return null
  const raw = await client.readContract({ address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] })
  const balance = Number(raw) / 1e6
  if (balance >= rule.threshold) return null
  return { value: balance, message: `USDC balance dropped to $${balance.toFixed(2)}, below your $${rule.threshold} threshold` }
}

async function evaluateYieldRateDrop(rule) {
  const market = AAVE_MARKET_BY_CHAIN[rule.chainId]
  const client = publicClientFor(rule.chainId)
  if (!market || !client) return null
  const data = await client.readContract({ address: market.pool, abi: RESERVE_DATA_ABI, functionName: 'getReserveData', args: [market.usdc] })
  const apyPercent = Number((data.currentLiquidityRate * 10_000n) / RAY) / 100
  if (apyPercent >= rule.threshold) return null
  return { value: apyPercent, message: `Aave supply APY dropped to ${apyPercent.toFixed(2)}%, below your ${rule.threshold}% threshold` }
}

/** No-ops (returns null) until ArcYieldPool is actually deployed and its address configured —
 *  same "degrade rather than fabricate" discipline as evaluateYieldRateDrop for an unsupported chain. */
async function evaluatePoolHealthDrop(rule) {
  if (!ARC_YIELD_POOL_ADDRESS) return null
  const client = publicClientFor(arcTestnet.id)
  if (!client) return null
  const data = await client.readContract({ address: ARC_YIELD_POOL_ADDRESS, abi: POOL_HEALTH_ABI, functionName: 'getPoolHealth' })
  const [, , obligation, coverageBps] = data
  if (obligation === 0n || coverageBps === UINT256_MAX) return null // no active obligation — nothing to warn about
  const coveragePercent = Number(coverageBps) / 100
  if (coveragePercent >= rule.threshold) return null
  return {
    value: coveragePercent,
    message: `ArcYieldPool reserve coverage dropped to ${coveragePercent.toFixed(0)}%, below your ${rule.threshold}% threshold`,
  }
}

async function evaluateLargeTransfer(db, wallet, ruleRef, rule) {
  const since = rule.lastCheckedAt?.toMillis?.() ?? Date.now() - FIRST_RUN_LOOKBACK_MS
  const snap = await db
    .collection('users')
    .doc(wallet)
    .collection('transfers')
    .where('timestamp', '>', new Date(since))
    .get()

  const triggers = []
  snap.forEach((doc) => {
    const entry = doc.data()
    const amountUsdc = outflowAmountUsdc(entry)
    if (amountUsdc !== null && amountUsdc >= rule.threshold) {
      triggers.push({
        value: amountUsdc,
        message: `${OUTFLOW_CATEGORY_BY_TYPE[entry.type]} of $${amountUsdc.toFixed(2)} exceeded your $${rule.threshold} threshold`,
        chain: entry.chain ?? entry.fromChain,
      })
    }
  })
  await ruleRef.update({ lastCheckedAt: new Date() })
  return triggers
}

/**
 * Evaluates every enabled alert rule and every active recurring-payment rule across all users.
 * Read-only against chain state; writes only alertEvents (triggered alerts) and bookkeeping
 * fields (lastTriggeredAt/lastCheckedAt) on the rule docs themselves. Never touches funds.
 */
export async function evaluateAlertsAndRecurring() {
  const db = getAdminFirestore()
  const now = Date.now()
  const summary = { rulesChecked: 0, alertsTriggered: 0, paymentsDueNotified: 0, errors: [] }

  // Plain collectionGroup fetch + in-memory filter, deliberately not `.where('enabled', '==',
  // true)` — a collectionGroup query with a filter needs a manually-created Firestore composite
  // index (confirmed against the real project: the first real run of this evaluator hit exactly
  // that FAILED_PRECONDITION error). At this app's realistic data volume (per-user rule counts in
  // the tens, not millions), reading every rule and filtering here trades a little read efficiency
  // for zero required manual Firebase Console setup.
  const ruleSnaps = await db.collectionGroup('alertRules').get()
  for (const ruleDoc of ruleSnaps.docs) {
    const rule = ruleDoc.data()
    if (!rule.enabled) continue
    const wallet = ruleDoc.ref.parent.parent?.id
    if (!wallet) continue
    summary.rulesChecked++

    try {
      const lastTriggeredAt = rule.lastTriggeredAt?.toMillis?.() ?? 0
      const withinCooldown = now - lastTriggeredAt < RETRIGGER_COOLDOWN_MS

      if (rule.type === 'large_transfer') {
        const triggers = await evaluateLargeTransfer(db, wallet, ruleDoc.ref, rule)
        for (const trigger of triggers) {
          await db.collection('users').doc(wallet).collection('alertEvents').add({
            ruleId: ruleDoc.id,
            ruleType: rule.type,
            message: trigger.message,
            chain: trigger.chain ?? null,
            value: trigger.value,
            threshold: rule.threshold,
            timestamp: new Date(),
          })
          summary.alertsTriggered++
        }
        if (triggers.length > 0) await ruleDoc.ref.update({ lastTriggeredAt: new Date() })
        continue
      }

      if (withinCooldown) continue

      const trigger =
        rule.type === 'low_balance'
          ? await evaluateLowBalance(wallet, rule)
          : rule.type === 'yield_rate_drop'
            ? await evaluateYieldRateDrop(rule)
            : rule.type === 'pool_health_drop'
              ? await evaluatePoolHealthDrop(rule)
              : null

      if (trigger) {
        await db.collection('users').doc(wallet).collection('alertEvents').add({
          ruleId: ruleDoc.id,
          ruleType: rule.type,
          message: trigger.message,
          value: trigger.value,
          threshold: rule.threshold,
          timestamp: new Date(),
        })
        await ruleDoc.ref.update({ lastTriggeredAt: new Date() })
        summary.alertsTriggered++
      }
    } catch (err) {
      summary.errors.push({ wallet, ruleId: ruleDoc.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Recurring payments: surface due rules as a "Payment Due" alert event — never executes anything.
  // Same "filter in memory, not in the query" reasoning as alertRules above.
  const recurringSnaps = await db.collectionGroup('recurringRules').get()
  for (const ruleDoc of recurringSnaps.docs) {
    const rule = ruleDoc.data()
    if (!rule.active) continue
    const wallet = ruleDoc.ref.parent.parent?.id
    if (!wallet) continue
    const dueAt = rule.nextDueAt?.toMillis?.()
    if (!dueAt || dueAt > now) continue
    const lastNotifiedAt = rule.lastDueNotificationAt?.toMillis?.() ?? 0
    if (now - lastNotifiedAt < RETRIGGER_COOLDOWN_MS) continue

    try {
      // 'pool_deposit' rules (see src/hooks/useRecurringRules.ts) have no recipient — they deposit
      // into Meridian's own ArcYieldPool contract instead of sending to an address.
      const message =
        rule.kind === 'pool_deposit'
          ? `Recurring deposit of ${rule.amount} USDC into ArcYieldPool is due`
          : `Recurring payment of ${rule.amount} USDC to ${rule.recipient.slice(0, 6)}…${rule.recipient.slice(-4)} is due`
      await db.collection('users').doc(wallet).collection('alertEvents').add({
        ruleId: ruleDoc.id,
        ruleType: 'payment_due',
        message,
        timestamp: new Date(),
      })
      await ruleDoc.ref.update({ lastDueNotificationAt: new Date() })
      summary.paymentsDueNotified++
    } catch (err) {
      summary.errors.push({ wallet, ruleId: ruleDoc.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return summary
}
