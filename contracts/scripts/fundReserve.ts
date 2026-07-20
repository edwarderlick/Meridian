import { ethers, network } from 'hardhat'

// Usage: POOL_ADDRESS=0x... AMOUNT_USDC=500 npm run fund-reserve:arc-testnet
const ARC_TESTNET_USDC = '0x3600000000000000000000000000000000000000'
const POOL_ADDRESS = process.env.POOL_ADDRESS
const AMOUNT_USDC = process.env.AMOUNT_USDC

async function main() {
  if (network.name !== 'arcTestnet') {
    throw new Error(`Refusing to fund a reserve on unexpected network "${network.name}" — expected "arcTestnet".`)
  }
  if (!POOL_ADDRESS) throw new Error('Set POOL_ADDRESS to the deployed ArcYieldPool address (see deploy.ts output).')
  if (!AMOUNT_USDC) throw new Error('Set AMOUNT_USDC (e.g. AMOUNT_USDC=500) — how much USDC to add to the reward reserve.')

  const [signer] = await ethers.getSigners()
  const amount = ethers.parseUnits(AMOUNT_USDC, 6)

  const usdc = await ethers.getContractAt('IERC20', ARC_TESTNET_USDC, signer)
  const pool = await ethers.getContractAt('ArcYieldPool', POOL_ADDRESS, signer)

  const allowance = await usdc.allowance(signer.address, POOL_ADDRESS)
  if (allowance < amount) {
    console.log('Approving pool to pull', AMOUNT_USDC, 'USDC...')
    await (await usdc.approve(POOL_ADDRESS, amount)).wait()
  }

  console.log('Funding reward reserve with', AMOUNT_USDC, 'USDC...')
  const tx = await pool.fundRewardReserve(amount)
  await tx.wait()
  console.log('Done. New reserve balance (raw):', (await pool.rewardReserve()).toString())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
