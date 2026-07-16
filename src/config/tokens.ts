import type { Address } from 'viem'
import { arcTestnet } from './chains'
import { arbitrumSepolia, avalancheFuji, baseSepolia, optimismSepolia, polygonAmoy, sepolia } from 'viem/chains'

export interface UsdcConfig {
  address: Address
  decimals: number
}

/**
 * ERC-20 USDC contract per chain — distinct from each chain's native gas
 * token. Verified against Circle's official testnet USDC contract address
 * list (developers.circle.com) at the time this was written.
 *
 * Arc Testnet is the one exception worth calling out explicitly: its native
 * gas token is ALSO called USDC (18 decimals, see chains.ts), but the ERC-20
 * USDC *interface* contract below is a separate address with 6 decimals —
 * don't conflate the two.
 */
export const USDC_BY_CHAIN: Record<number, UsdcConfig> = {
  [arcTestnet.id]: { address: '0x3600000000000000000000000000000000000000', decimals: 6 },
  [sepolia.id]: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  [arbitrumSepolia.id]: { address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', decimals: 6 },
  [baseSepolia.id]: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6 },
  [optimismSepolia.id]: { address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', decimals: 6 },
  [avalancheFuji.id]: { address: '0x5425890298aed601595a70AB815c96711a31Bc65', decimals: 6 },
  [polygonAmoy.id]: { address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', decimals: 6 },
}
