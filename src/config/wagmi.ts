import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { evmChains } from './chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Meridian Console',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: evmChains,
  ssr: false,
})
