import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'dotenv/config'

// Isolated from the frontend's env: DEPLOYER_PRIVATE_KEY only ever lives in this subproject's own
// .env (gitignored), loaded into process.env by the 'dotenv/config' import above — Hardhat does
// NOT load .env files on its own, unlike the main app's `node --env-file=.env`. It must never be
// pasted into chat or committed — fund a throwaway testnet-only wallet, never a key that holds
// anything of real value.
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const ARC_TESTNET_RPC_URL = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    arcTestnet: {
      url: ARC_TESTNET_RPC_URL,
      chainId: 5042002,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
}

export default config
