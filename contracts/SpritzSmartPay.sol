// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./lib/SubscriptionChargeDate.sol";

contract SpritzSmartPay is Context, Pausable, Ownable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SubscriptionChargeDate for uint256;

    /**
     * @notice Thrown when the transfer of tokens fails
     * @param owner The address of the ERC-20 token
     * @param subscriptionId The transfer recipient
     * @param amount The amount of the token transfers
     */
    error ChargeSubscriptionFailed(address owner, bytes32 subscriptionId, uint256 amount);

    /**
     * @notice Thrown when attempting to incorrectly charge the subscription
     * @param subscriptionId The id of the subscription
     * @param date Timstamp of the attempted charge
     */
    error InvalidPaymentCharge(bytes32 subscriptionId, uint256 date);

    /**
     * @notice Thrown when an unauthorised wallet tries to spend user funds
     * @param caller The wallet calling the guarded method
     */
    error UnauthorizedExecutor(address caller);

    /**
     * @notice Thrown when attempting to use an invalid
     */
    error InvalidAddress();

    /**
     * @notice Emitted when a user creates a new subscription
     * @param user The user who owns the subscription
     * @param subscriptionId The id of the subscription
     */
    event SubscriptionCreated(address indexed user, bytes32 indexed subscriptionId);

    /**
     * @notice Emitted when a user deactivates their subscription
     * @param user The user who owns the subscription
     * @param subscriptionId The id of the subscription
     */
    event SubscriptionDeactivated(address indexed user, bytes32 indexed subscriptionId);

    /**
     * @notice Emitted when a user becomes active
     * @param user The user who created a subscription
     */
    event UserActivated(address indexed user);

    /**
     * @notice The valid timings/cadence in which a subscription can be charged
     */
    enum SubscriptionCadence {
        MONTHLY,
        WEEKLY,
        DAILY
    }

    /**
     * @dev Configuration for a user fixed payment subscription
     * @param cadence The timing of the subscription: monthly, weekly, daily
     * @param paymentAmount The amount in fiat of the payment, 2 decimals
     * @param paymentCount The current number of payments made on the subscription
     * @param totalPayments The total number of payments allowed on the subscription. 0 = unlimited
     * @param owner The owner of the subscription
     * @param paymentToken The address of the token withdrawn from the users wallet
     * @param startTime The date from which the first payment is allowed
     * @param lastPaymentTimestamp The timestamp of the last payment
     * @param paymentReference The payment reference
     */
    struct Subscription {
        SubscriptionCadence cadence;
        uint32 paymentAmount;
        uint128 paymentCount;
        uint128 totalPayments;
        address owner;
        address paymentToken;
        uint256 startTime;
        uint256 lastPaymentTimestamp;
        bytes32 paymentReference;
    }

    bytes4 private constant DECIMALS_SELECTOR = bytes4(keccak256("decimals()"));

    /// @notice The wallet owned by spritz that receives payments
    address internal immutable SPRITZ_PAY_ADDRESS;

    /// @notice The wallet owned by spritz that executes sensitive payments
    address internal immutable AUTO_TASK_BOT_ADDRESS;

    /// @notice List of all users who have a subscription
    EnumerableSet.AddressSet private activeUsers;

    /// @notice Mapping of the subscription id to the subscription
    mapping(bytes32 => Subscription) public subscriptions;

    /// @notice Subscription ids attributed to a user
    mapping(address => EnumerableSet.Bytes32Set) internal userSubscriptions;

    /// @notice Nonce for user subscriptions
    mapping(address => uint128) public subscriptionNonce;

    constructor(address spritzPay, address autoTaskWallet) {
        if (spritzPay == address(0) || autoTaskWallet == address(0)) revert InvalidAddress();
        SPRITZ_PAY_ADDRESS = spritzPay;
        AUTO_TASK_BOT_ADDRESS = autoTaskWallet;
    }

    /**
     * @dev Throws if called by any account other than the auto task wallet.
     */
    modifier onlyAutoTaskBot() {
        _checkAutoTaskAddress(msg.sender);
        _;
    }

    /**
     * @dev Attempt to register a user after their first subscription
     */
    modifier checksActiveSubscriptions() {
        _;
        _checkActiveSubscriptions(msg.sender);
    }

    /**
     * @notice Get all subscriptions for a given user address
     * @param user The address of the subscriber
     * @return An array of bytes32 values that map to subscriptions
     */
    function getUserSubscriptions(address user) external view returns (bytes32[] memory) {
        return userSubscriptions[user].values();
    }

    /**
     * @notice Count of all user subscriptions
     * @param user The address of the subscriber
     * @return An array of bytes32 values that map to subscriptions
     */
    function getUserSubscriptionCount(address user) external view returns (uint256) {
        return userSubscriptions[user].length();
    }

    /**
     * @notice Get all subscriptions for a given user address
     * @param subscriptionId The address of the subscriber
     * @return An array of bytes32 values that map to subscriptions
     */
    function getSubscription(bytes32 subscriptionId) public view returns (Subscription memory) {
        return subscriptions[subscriptionId];
    }

    /**
     * @dev Get all users with subscriptions
     * @return An array of the unique user addresses
     */
    function getActiveUsers() external view returns (address[] memory) {
        return activeUsers.values();
    }

    /**
     * @notice Check if a subscription is ready to be charged
     * @param subscriptionId The id of the subscription
     */
    function canChargeSubscription(bytes32 subscriptionId) public view returns (bool) {
        Subscription memory subscription = getSubscription(subscriptionId);
        if (subscription.totalPayments > 0 && subscription.paymentCount == subscription.totalPayments) return false;

        SubscriptionCadence cadence = subscription.cadence;

        if (cadence == SubscriptionCadence.MONTHLY) {
            return block.timestamp.validMonthsSince(subscription.startTime, subscription.paymentCount);
        }
        if (cadence == SubscriptionCadence.WEEKLY) {
            return block.timestamp.validWeeksSince(subscription.startTime, subscription.paymentCount);
        }
        if (cadence == SubscriptionCadence.DAILY) {
            return block.timestamp.validDaysSince(subscription.startTime, subscription.paymentCount);
        }
        return false;
    }

    /**
     * @dev Deactivate a subscription
     * @param subscriptionId The subscription ID to deactivate
     */
    function deactivateSubscription(bytes32 subscriptionId) external checksActiveSubscriptions {
        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.owner != msg.sender) revert UnauthorizedExecutor(msg.sender);

        userSubscriptions[msg.sender].remove(subscriptionId);
        delete subscriptions[subscriptionId];

        emit SubscriptionDeactivated(msg.sender, subscriptionId);
    }

    /**
     * @notice Get all subscriptions for a given user address
     * @param paymentAmount The address of the subscriber
     * @param paymentToken An array of bytes32 values that map to subscriptions
     * @param startTime An array of bytes32 values that map to subscriptions
     * @param totalPayments An array of bytes32 values that map to subscriptions
     * @param paymentReference An array of bytes32 values that map to subscriptions
     */
    function createSubscription(
        uint32 paymentAmount,
        uint128 totalPayments,
        address paymentToken,
        uint256 startTime,
        bytes32 paymentReference,
        SubscriptionCadence cadence
    ) public checksActiveSubscriptions {
        unchecked {
            subscriptionNonce[msg.sender] += 1;
        }

        Subscription memory subscription = Subscription({
            cadence: cadence,
            paymentAmount: paymentAmount,
            paymentCount: 0,
            totalPayments: totalPayments,
            owner: msg.sender,
            paymentToken: paymentToken,
            startTime: startTime,
            lastPaymentTimestamp: 0,
            paymentReference: paymentReference
        });

        // create a new subscription id for the user
        bytes32 subscriptionId = newSubscriptionId();

        // store subscription
        subscriptions[subscriptionId] = subscription;
        // attribute subscription to user
        userSubscriptions[msg.sender].add(subscriptionId);

        emit SubscriptionCreated(msg.sender, subscriptionId);
    }

    /**
     * @notice Process the payment for a given subscription
     * @param subscriptionId The id of the subscription
     */
    function processPayment(bytes32 subscriptionId) external whenNotPaused {
        Subscription storage subscription = subscriptions[subscriptionId];

        bool canCharge = canChargeSubscription(subscriptionId);
        if (!canCharge) revert InvalidPaymentCharge(subscriptionId, block.timestamp);

        subscription.lastPaymentTimestamp = block.timestamp;
        subscription.paymentCount += 1;
        uint256 paymentTokenAmount = tokenAmount(subscription.paymentAmount, subscription.paymentToken);

        chargeSubscription(subscription, subscriptionId, paymentTokenAmount);

        checkSpirtzPayApproval(subscription.paymentToken, paymentTokenAmount);
        // spritzPay.call(abi.encodeWithSignature('payWithToken(address,uint256,bytes32)', ))
    }

    /**
     * @dev Throws if the sender is not the spritz auto task bot
     * @param caller The address calling the contract method
     */
    function _checkAutoTaskAddress(address caller) private view {
        if (AUTO_TASK_BOT_ADDRESS != caller) revert UnauthorizedExecutor(caller);
    }

    /**
     * @dev Update users active status if needed
     * @param user Address of the user
     */
    function _checkActiveSubscriptions(address user) private {
        bool isActive = activeUsers.contains(user);
        EnumerableSet.Bytes32Set storage _userSubscriptions = userSubscriptions[user];
        uint256 subscriptionCount = _userSubscriptions.length();

        if (isActive && subscriptionCount == 0) {
            activeUsers.remove(user);
        } else if (!isActive && subscriptionCount > 0) {
            activeUsers.add(user);
            emit UserActivated(user);
        }
    }

    /**
     * @dev Compute a collision-resistant id for the subscription
     */
    function newSubscriptionId() private view returns (bytes32) {
        return keccak256(abi.encodePacked(msg.sender, subscriptionNonce[msg.sender]));
    }

    // need to check this
    function tokenAmount(uint32 paymentAmount, address tokenAddress) internal view returns (uint256) {
        (bool success, bytes memory returnData) = tokenAddress.staticcall(abi.encodeWithSelector(DECIMALS_SELECTOR));
        require(success, "couldnt get decimals");
        uint8 decimals = abi.decode(returnData, (uint8));
        return paymentAmount * (10**(decimals - 2));
    }

    /**
     * @notice Attempt to withdraw funds from users wallet
     * @param subscription The subscription being charged
     * @param subscriptionId The id of the subscription
     * @param amount The amount of the subscription payment token to be charged
     */
    function chargeSubscription(
        Subscription storage subscription,
        bytes32 subscriptionId,
        uint256 amount
    ) private {
        IERC20Upgradeable token = IERC20Upgradeable(subscription.paymentToken);
        token.safeTransferFrom(subscription.owner, address(this), amount);
    }

    /**
     * @dev Check that the SpritzPay contract has spend approval for the token
     * @param token Address of the ERC-20 payment token
     * @param amount The amount of the outgoing payment
     */
    function checkSpirtzPayApproval(address token, uint256 amount) private {
        IERC20Upgradeable paymentToken = IERC20Upgradeable(token);
        if (paymentToken.allowance(address(this), SPRITZ_PAY_ADDRESS) < amount) {
            paymentToken.safeApprove(SPRITZ_PAY_ADDRESS, 2**256 - 1);
        }
    }

    /*
     * Admin functions
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
