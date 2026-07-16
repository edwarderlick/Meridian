import { createUnifiedBalanceKitContext } from '@circle-fin/unified-balance-kit'

/**
 * One shared Unified Balance Kit context for the app — same singleton discipline as Bridge's
 * `const kit = new BridgeKit()` in Bridge.tsx, except this SDK is function-based against a plain
 * context object rather than a class instance (`deposit(context, params)`, `spend(context, params)`,
 * `getBalances(context, params)` — never `context.deposit(...)`). The context itself is a stateless
 * POJO (`{ providers, customFeePolicy? }`, confirmed via the SDK's own type declarations — it holds
 * no connections or mutable state), so creating it once at module scope is safe and matches Circle's
 * own documented pattern.
 *
 * `createUnifiedBalanceKitContext()` with no arguments defaults to Gateway v1
 * (`getDefaultProviders()` returns the built-in Gateway v1 provider) — no explicit provider wiring
 * needed here.
 */
export const unifiedBalanceContext = createUnifiedBalanceKitContext()
