// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ArcYieldPool
/// @notice A single-token USDC yield pool with three strategies (Flexible, 7-day, 30-day lock).
/// Experimental testnet prototype — reward accounting is real and on-chain, but this contract
/// has not been audited and should never hold real value.
///
/// Design choices, stated plainly rather than left implicit:
/// - One active strategy per wallet at a time. Depositing again while a position is open must
///   target the SAME strategy (a top-up); switching strategies requires withdrawing first. This
///   avoids weighted-average accrual across mixed lock periods, which is a real source of subtle
///   bugs in pools that allow it.
/// - A top-up realizes (flushes) all rewards accrued so far into `accruedRewards`, THEN restarts
///   the accrual clock and, for locked strategies, restarts the lock from `block.timestamp`. No
///   already-earned reward time is lost, but the lock itself is genuinely extended — surfaced in
///   the frontend, not hidden.
/// - Principal and the reward reserve are separate ledgers. Rewards are only ever paid out of
///   `rewardReserve`, which someone (the owner, or anyone via `fundRewardReserve`) must actually
///   fund. If the reserve can't cover a withdrawal's accrued rewards, the withdrawal reverts
///   rather than silently paying less than owed — `getPoolHealth()` exposes reserve coverage and
///   estimated runway so this can be seen coming, not discovered as a failed transaction.
contract ArcYieldPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint8 public constant STRATEGY_COUNT = 3;

    struct StrategyConfig {
        uint64 lockDuration; // seconds; 0 = flexible, withdrawable any time
        uint16 aprBps; // annual rate, in basis points
    }

    struct Position {
        uint8 strategyId;
        bool active;
        uint256 principal;
        uint256 accruedRewards;
        uint256 lastAccrualAt;
        uint256 lockedUntil;
    }

    IERC20 public immutable usdc;

    mapping(uint8 => StrategyConfig) public strategies;
    mapping(uint8 => uint256) public principalByStrategy;
    mapping(address => Position) public positions;

    uint256 public totalPrincipal;
    uint256 public rewardReserve;

    event Deposited(address indexed user, uint8 indexed strategyId, uint256 amount, uint256 newPrincipal);
    event Withdrawn(address indexed user, uint256 principalAmount, uint256 rewardsPaid, bool closed);
    event ReserveFunded(address indexed funder, uint256 amount, uint256 newReserve);
    event StrategyAprUpdated(uint8 indexed strategyId, uint16 aprBps);

    error ZeroAmount();
    error InvalidStrategy();
    error StrategyMismatch(uint8 activeStrategyId, uint8 requestedStrategyId);
    error NoPosition();
    error StillLocked(uint256 unlocksAt);
    error InsufficientPrincipal(uint256 requested, uint256 available);
    error InsufficientReserve(uint256 requested, uint256 available);

    /// @param _usdc The real USDC ERC-20 contract this pool custodies (6 decimals on Arc Testnet).
    /// @param initialOwner Address allowed to tune strategy APRs after deployment.
    constructor(IERC20 _usdc, address initialOwner) Ownable(initialOwner) {
        usdc = _usdc;
        // Lock durations are fixed for the life of this contract — changing a lock period out
        // from under an existing depositor would be a real integrity problem, not just a config
        // tweak, so only APR is adjustable post-deploy.
        strategies[0] = StrategyConfig({ lockDuration: 0, aprBps: 400 }); // Flexible, 4% APR
        strategies[1] = StrategyConfig({ lockDuration: 7 days, aprBps: 800 }); // 7-day, 8% APR
        strategies[2] = StrategyConfig({ lockDuration: 30 days, aprBps: 1200 }); // 30-day, 12% APR
    }

    /// @notice Deposit `amount` USDC into `strategyId`. If a position is already open, `strategyId`
    /// must match it — this is a top-up, and it restarts the lock (see contract-level notes).
    function deposit(uint256 amount, uint8 strategyId) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (strategyId >= STRATEGY_COUNT) revert InvalidStrategy();

        Position storage pos = positions[msg.sender];
        if (pos.active && pos.strategyId != strategyId) {
            revert StrategyMismatch(pos.strategyId, strategyId);
        }

        _accrue(pos);

        if (!pos.active) {
            pos.active = true;
            pos.strategyId = strategyId;
        }
        pos.principal += amount;

        StrategyConfig memory cfg = strategies[strategyId];
        if (cfg.lockDuration > 0) {
            pos.lockedUntil = block.timestamp + cfg.lockDuration;
        }

        principalByStrategy[strategyId] += amount;
        totalPrincipal += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, strategyId, amount, pos.principal);
    }

    /// @notice Withdraw `principalAmount` of principal plus all currently accrued rewards.
    /// Reverts if the position's strategy is still locked, or if the reserve can't cover the
    /// accrued rewards owed — it never pays out less than what's owed.
    function withdraw(uint256 principalAmount) external nonReentrant {
        Position storage pos = positions[msg.sender];
        if (!pos.active) revert NoPosition();

        _accrue(pos);

        StrategyConfig memory cfg = strategies[pos.strategyId];
        if (cfg.lockDuration > 0 && block.timestamp < pos.lockedUntil) {
            revert StillLocked(pos.lockedUntil);
        }
        if (principalAmount == 0 || principalAmount > pos.principal) {
            revert InsufficientPrincipal(principalAmount, pos.principal);
        }

        uint256 rewards = pos.accruedRewards;
        if (rewards > rewardReserve) revert InsufficientReserve(rewards, rewardReserve);

        pos.principal -= principalAmount;
        pos.accruedRewards = 0;
        rewardReserve -= rewards;
        principalByStrategy[pos.strategyId] -= principalAmount;
        totalPrincipal -= principalAmount;

        bool closed = pos.principal == 0;
        if (closed) {
            delete positions[msg.sender];
        }

        uint256 payout = principalAmount + rewards;
        usdc.safeTransfer(msg.sender, payout);
        emit Withdrawn(msg.sender, principalAmount, rewards, closed);
    }

    /// @notice Top up the reward reserve. Anyone can call this — it's a transparent, separate
    /// ledger from user principal, matching what `getPoolHealth()` reports.
    function fundRewardReserve(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        rewardReserve += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount, rewardReserve);
    }

    function setStrategyApr(uint8 strategyId, uint16 aprBps) external onlyOwner {
        if (strategyId >= STRATEGY_COUNT) revert InvalidStrategy();
        strategies[strategyId].aprBps = aprBps;
        emit StrategyAprUpdated(strategyId, aprBps);
    }

    /// @notice Rewards accrued so far, including time elapsed since the last accrual checkpoint —
    /// the same figure a withdrawal would realize right now. Safe to call from a UI on every block.
    function pendingRewards(address user) public view returns (uint256) {
        Position storage pos = positions[user];
        if (!pos.active) return 0;
        return pos.accruedRewards + _accruedSince(pos.principal, pos.strategyId, pos.lastAccrualAt);
    }

    function getPosition(address user)
        external
        view
        returns (uint8 strategyId, uint256 principal, uint256 rewardsOwed, uint256 lockedUntil, bool active)
    {
        Position storage pos = positions[user];
        return (pos.strategyId, pos.principal, pendingRewards(user), pos.lockedUntil, pos.active);
    }

    function getStrategy(uint8 strategyId)
        external
        view
        returns (uint64 lockDuration, uint16 aprBps, uint256 principalInStrategy)
    {
        if (strategyId >= STRATEGY_COUNT) revert InvalidStrategy();
        StrategyConfig memory cfg = strategies[strategyId];
        return (cfg.lockDuration, cfg.aprBps, principalByStrategy[strategyId]);
    }

    /// @notice Real, computed-not-fabricated pool health: what's deposited, what's reserved to pay
    /// rewards, the annualized obligation implied by current deposits, and how long the reserve
    /// would last paying that obligation at the current rate (`type(uint256).max` reads as "no
    /// active obligation" when nothing is deposited, not literally infinite runway).
    function getPoolHealth()
        external
        view
        returns (
            uint256 totalDeposits,
            uint256 reserve,
            uint256 projectedAnnualObligation,
            uint256 reserveCoverageBps,
            uint256 estimatedRunwaySeconds
        )
    {
        totalDeposits = totalPrincipal;
        reserve = rewardReserve;

        uint256 obligation = 0;
        for (uint8 i = 0; i < STRATEGY_COUNT; i++) {
            obligation += (principalByStrategy[i] * strategies[i].aprBps) / BPS_DENOMINATOR;
        }
        projectedAnnualObligation = obligation;

        if (obligation == 0) {
            reserveCoverageBps = type(uint256).max;
            estimatedRunwaySeconds = type(uint256).max;
        } else {
            reserveCoverageBps = (reserve * BPS_DENOMINATOR) / obligation;
            estimatedRunwaySeconds = (reserve * SECONDS_PER_YEAR) / obligation;
        }
    }

    function _accrue(Position storage pos) private {
        if (pos.active) {
            pos.accruedRewards += _accruedSince(pos.principal, pos.strategyId, pos.lastAccrualAt);
        }
        pos.lastAccrualAt = block.timestamp;
    }

    function _accruedSince(uint256 principal, uint8 strategyId, uint256 sinceTimestamp)
        private
        view
        returns (uint256)
    {
        if (principal == 0) return 0;
        uint256 elapsed = block.timestamp - sinceTimestamp;
        if (elapsed == 0) return 0;
        uint16 aprBps = strategies[strategyId].aprBps;
        return (principal * aprBps * elapsed) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }
}
