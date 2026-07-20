import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import type { ArcYieldPool, MockUSDC } from '../typechain-types'
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

const USDC = (n: number) => ethers.parseUnits(n.toString(), 6)
const YEAR = 365 * 24 * 60 * 60

describe('ArcYieldPool', () => {
  let owner: HardhatEthersSigner
  let alice: HardhatEthersSigner
  let bob: HardhatEthersSigner
  let usdc: MockUSDC
  let pool: ArcYieldPool

  beforeEach(async () => {
    ;[owner, alice, bob] = await ethers.getSigners()

    const MockUSDCFactory = await ethers.getContractFactory('MockUSDC')
    usdc = await MockUSDCFactory.deploy()

    const PoolFactory = await ethers.getContractFactory('ArcYieldPool')
    pool = await PoolFactory.deploy(await usdc.getAddress(), owner.address)

    for (const user of [alice, bob]) {
      await usdc.mint(user.address, USDC(100_000))
      await usdc.connect(user).approve(await pool.getAddress(), ethers.MaxUint256)
    }
    await usdc.mint(owner.address, USDC(1_000_000))
    await usdc.connect(owner).approve(await pool.getAddress(), ethers.MaxUint256)
  })

  it('accrues flexible-strategy rewards linearly and pays out on withdrawal', async () => {
    await pool.connect(owner).fundRewardReserve(USDC(10_000))
    await pool.connect(alice).deposit(USDC(1_000), 0) // Flexible, 4% APR

    await time.increase(YEAR / 2) // half a year

    const pending = await pool.pendingRewards(alice.address)
    // 1000 * 4% * 0.5 = 20 USDC, allow tiny rounding slack from block timestamp drift
    expect(pending).to.be.closeTo(USDC(20), USDC(1))

    const balBefore = await usdc.balanceOf(alice.address)
    await pool.connect(alice).withdraw(USDC(1_000))
    const balAfter = await usdc.balanceOf(alice.address)
    expect(balAfter - balBefore).to.be.closeTo(USDC(1_020), USDC(1))
  })

  it('rejects withdrawing a locked strategy before unlock, allows after', async () => {
    await pool.connect(owner).fundRewardReserve(USDC(10_000))
    await pool.connect(alice).deposit(USDC(1_000), 1) // 7-day lock

    await expect(pool.connect(alice).withdraw(USDC(1_000))).to.be.revertedWithCustomError(
      pool,
      'StillLocked',
    )

    await time.increase(7 * 24 * 60 * 60 + 1)
    await expect(pool.connect(alice).withdraw(USDC(1_000))).to.not.be.reverted
  })

  it('rejects switching strategy on top-up but allows topping up the same one', async () => {
    await pool.connect(alice).deposit(USDC(500), 0)
    await expect(pool.connect(alice).deposit(USDC(500), 1)).to.be.revertedWithCustomError(
      pool,
      'StrategyMismatch',
    )
    await expect(pool.connect(alice).deposit(USDC(500), 0)).to.not.be.reverted
    const [, principal] = await pool.getPosition(alice.address)
    expect(principal).to.equal(USDC(1_000))
  })

  it('a top-up restarts the lock without losing already-accrued rewards', async () => {
    await pool.connect(owner).fundRewardReserve(USDC(10_000))
    await pool.connect(alice).deposit(USDC(1_000), 1) // 7-day lock, 8% APR

    await time.increase(3 * 24 * 60 * 60) // 3 days in
    const accruedBeforeTopUp = await pool.pendingRewards(alice.address)
    expect(accruedBeforeTopUp).to.be.gt(0)

    await pool.connect(alice).deposit(USDC(500), 1) // top up, restarts the 7-day lock

    // Rewards weren't lost by the top-up.
    const accruedAfterTopUp = await pool.pendingRewards(alice.address)
    expect(accruedAfterTopUp).to.be.gte(accruedBeforeTopUp)

    // But the lock restarted — withdrawing immediately after the top-up still reverts.
    await expect(pool.connect(alice).withdraw(USDC(1_500))).to.be.revertedWithCustomError(
      pool,
      'StillLocked',
    )
  })

  it('reverts withdrawal if the reward reserve cannot cover what is owed', async () => {
    // Deliberately do NOT fund the reserve.
    await pool.connect(alice).deposit(USDC(1_000), 0)
    await time.increase(YEAR)

    await expect(pool.connect(alice).withdraw(USDC(1_000))).to.be.revertedWithCustomError(
      pool,
      'InsufficientReserve',
    )
  })

  it('reports pool health honestly from real on-chain state', async () => {
    await pool.connect(owner).fundRewardReserve(USDC(1_000))
    await pool.connect(alice).deposit(USDC(10_000), 0) // 4% APR
    await pool.connect(bob).deposit(USDC(5_000), 2) // 12% APR

    const health = await pool.getPoolHealth()
    expect(health.totalDeposits).to.equal(USDC(15_000))
    expect(health.reserve).to.equal(USDC(1_000))
    // obligation = 10,000*4% + 5,000*12% = 400 + 600 = 1,000 USDC/year
    expect(health.projectedAnnualObligation).to.equal(USDC(1_000))
    // reserve exactly covers one year of obligation -> 10,000 bps = 100% coverage
    expect(health.reserveCoverageBps).to.equal(10_000n)
    expect(health.estimatedRunwaySeconds).to.be.closeTo(BigInt(YEAR), 5n)
  })

  it('only the owner can change a strategy APR', async () => {
    await expect(pool.connect(alice).setStrategyApr(0, 999)).to.be.revertedWithCustomError(
      pool,
      'OwnableUnauthorizedAccount',
    )
    await expect(pool.connect(owner).setStrategyApr(0, 999)).to.not.be.reverted
    const [, aprBps] = await pool.getStrategy(0)
    expect(aprBps).to.equal(999)
  })
})
