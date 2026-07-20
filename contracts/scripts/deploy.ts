import { ethers, network } from 'hardhat'

// Arc Testnet's real, live USDC ERC-20 (6 decimals) — same address the frontend already uses,
// see src/config/tokens.ts. Never point this at anything else on this network.
const ARC_TESTNET_USDC = '0x3600000000000000000000000000000000000000'

async function main() {
  if (network.name !== 'arcTestnet') {
    throw new Error(`Refusing to deploy ArcYieldPool on unexpected network "${network.name}" — expected "arcTestnet".`)
  }

  const [deployer] = await ethers.getSigners()
  console.log('Deploying ArcYieldPool from:', deployer.address)

  const PoolFactory = await ethers.getContractFactory('ArcYieldPool')
  const pool = await PoolFactory.deploy(ARC_TESTNET_USDC, deployer.address)
  await pool.waitForDeployment()

  const address = await pool.getAddress()
  console.log('ArcYieldPool deployed to:', address)
  console.log('Verify with: npx hardhat verify --network arcTestnet', address, ARC_TESTNET_USDC, deployer.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
