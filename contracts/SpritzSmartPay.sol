// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";

import "./SpritzPayV3.sol";
import "./lib/SubscriptionChargeDate.sol";

/**
 * @title SpritzSmartPay
 * @author Spritz Finance
 * @notice A contract for creating and processing recurring subscriptions. SpritzSmartPay acts as the manager of the
 * subscriptions, allows subscriptions to be created, validated and processed, but delegates the actual payment logic
 * to the SpritzPay contract.
 */
contract SpritzSmartPay is Initializable, AccessControlEnumerableUpgradeable, EIP712Upgradeable {
    using SubscriptionChargeDate for uint256;

    bytes32 public constant PAYMENT_PROCESSOR_ROLE = keccak256("PAYMENT_PROCESSOR_ROLE");

    bytes32 public constant SUBSCRIPTION_TYPEHASH =
        keccak256(
            "Subscription(address paymentToken,uint256 paymentAmountMax,uint256 startTime,uint256 totalPayments,bytes32 paymentReference,uint8 cadence,uint8 subscriptionType)"
        );

    event SubscriptionCreated(
        address indexed subscriber,
        bytes32 indexed subscriptionId,
        address indexed paymentToken,
        uint256 paymentAmountMax,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        SubscriptionType subscriptionType
    );

    event PaymentProcessed(address indexed subscriber, bytes32 indexed subscriptionId);

    event SubscriptionDeleted(bytes32 indexed subscriptionId);

    error InvalidPaymentCharge(bytes32 subscriptionId, uint256 date);

    error InvalidSubscription();

    error InvalidPaymentValue();

    error InvalidSubscriptionType();

    error SubscriptionAlreadyExists(bytes32 subscriptionId);

    error SubscriptionNotFound(bytes32 subscriptionId);

    error InvalidSignature();

    /// @notice The valid timings/cadence in which a subscription can be charged
    enum SubscriptionCadence {
        MONTHLY,
        WEEKLY,
        DAILY
    }

    /// @notice The type of the subscription, paying via swap or direct token transfer
    enum SubscriptionType {
        DIRECT,
        SWAP
    }

    /// @dev components of an ECDSA signature
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /**
     * @dev Configuration for a user fixed payment subscription
     * @param paymentCount The current number of payments made on the subscription
     * @param startTime The date from which the first payment is allowed
     * @param lastPaymentTimestamp The timestamp of the last payment
     * @dev startTime is not an essential property to store on-chain, but we will be using
     * it to validate the existance of a proposal as paymentCount and lastPaymentTimestamp
     * can both be 0, while startTime cannot.
     */
    struct Subscription {
        uint256 paymentCount;
        uint256 startTime;
        uint256 lastPaymentTimestamp;
    }

    /**
     * @dev Configuration for a payment by swapping an input token on chain
     * @param sourceTokenAmountMax The max amount of the input token that can be swapped
     * @param paymentTokenAmount The amount of the output token required from the swap
     * @param deadline The deadline of the swap
     * @param swapData Arbitrary bytes string containing swap data
     */
    struct SwapParams {
        uint256 sourceTokenAmountMax;
        uint256 paymentTokenAmount;
        uint256 deadline;
        bytes swapData;
    }

    /**
     * @dev Configuration for a payment by swapping an input token on chain
     * @param paymentToken The address of the token used for payment
     * @param paymentAmountMax The maximum amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     * @param subscriptionType The type of the subscrition, direct payment or swap
     */
    struct SubscriptionParams {
        address paymentToken;
        uint256 paymentAmountMax;
        uint256 startTime;
        uint256 totalPayments;
        bytes32 paymentReference;
        SubscriptionCadence cadence;
        SubscriptionType subscriptionType;
    }

    /// @notice The address of the SpritzPay smart contract
    SpritzPayV3 internal spritzPay;

    /// @notice Mapping of the subscription id to the subscription on-chain data
    mapping(bytes32 => Subscription) public subscriptions;

    /**
     * @dev Constructor for upgradable contract
     */
    function initialize(address admin, address _spritzPay, address paymentBot) public virtual initializer {
        __AccessControlEnumerable_init();
        __EIP712_init("SpritzSmartPay", version());
        spritzPay = SpritzPayV3(_spritzPay);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAYMENT_PROCESSOR_ROLE, paymentBot);
    }

    function version() public pure returns (string memory) {
        return "1";
    }

    /**
     * @notice Create a subscription on behalf of a user using an EIP-712 signature
     * @param _subscriber The address of user who the subscription belongs to
     * @param paymentToken The address of the token used for payment
     * @param paymentAmountMax The maximum amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     * @param subscriptionType The type of the subscrition, direct payment or swap
     * @param signature The message signed by the user
     * @dev The bulk of the subscription data is emitted in the "SubscriptionCreated" event and will be stored off-chain.
     * This allows us to save significant gas by only storing critcal/variable data on-chain, and using a hash to validate the off-chain
     * data
     */
    function createSubscriptionBySignature(
        address _subscriber,
        address paymentToken,
        uint256 paymentAmountMax,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        SubscriptionType subscriptionType,
        Signature calldata signature
    ) external {
        if (paymentAmountMax == 0 || startTime == 0) revert InvalidSubscription();

        address subscriber = ECDSAUpgradeable.recover(
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        SUBSCRIPTION_TYPEHASH,
                        paymentToken,
                        paymentAmountMax,
                        startTime,
                        totalPayments,
                        paymentReference,
                        cadence,
                        subscriptionType
                    )
                )
            ),
            signature.v,
            signature.r,
            signature.s
        );
        if (_subscriber != subscriber) revert InvalidSignature();

        bytes32 subscriptionId = hashSubscription(
            subscriber,
            paymentToken,
            paymentAmountMax,
            startTime,
            totalPayments,
            paymentReference,
            cadence,
            subscriptionType
        );

        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.startTime > 0) revert SubscriptionAlreadyExists(subscriptionId);

        subscription.startTime = startTime;

        emit SubscriptionCreated(
            subscriber,
            subscriptionId,
            paymentToken,
            paymentAmountMax,
            startTime,
            totalPayments,
            paymentReference,
            cadence,
            subscriptionType
        );
    }

    /**
     * @notice Create a subscription
     * @param paymentToken The address of the token used for payment
     * @param paymentAmountMax The maximum amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     * @param subscriptionType The type of the subscrition, direct payment or swap
     * @dev The bulk of the subscription data is emitted in the "SubscriptionCreated" event and will be stored off-chain.
     * This allows us to save significant gas by only storing critcal/variable data on-chain, and using a hash to validate the off-chain
     * data
     */
    function createSubscription(
        address paymentToken,
        uint256 paymentAmountMax,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        SubscriptionType subscriptionType
    ) external {
        if (paymentAmountMax == 0 || startTime == 0) revert InvalidSubscription();

        bytes32 subscriptionId = hashSubscription(
            msg.sender,
            paymentToken,
            paymentAmountMax,
            startTime,
            totalPayments,
            paymentReference,
            cadence,
            subscriptionType
        );

        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.startTime > 0) revert SubscriptionAlreadyExists(subscriptionId);

        subscription.startTime = startTime;

        emit SubscriptionCreated(
            msg.sender,
            subscriptionId,
            paymentToken,
            paymentAmountMax,
            startTime,
            totalPayments,
            paymentReference,
            cadence,
            subscriptionType
        );
    }

    /**
     * @notice Charges the given subscription and sends the payment to the SpritzPay contract
     * @param subscriber The account who owns the subscription
     * @param paymentAmount The total amount of the token payment
     * @param params The parameters for the subscription
     * @param externalPaymentReference The reference passed on to delegated payment contract
     */
    function processTokenPayment(
        address subscriber,
        uint256 paymentAmount,
        SubscriptionParams calldata params,
        bytes32 externalPaymentReference
    ) external onlyRole(PAYMENT_PROCESSOR_ROLE) {
        if (params.subscriptionType != SubscriptionType.DIRECT) revert InvalidSubscriptionType();

        bytes32 subscriptionId = _processSubscriptionCharge(
            subscriber,
            params.paymentToken,
            params.paymentAmountMax,
            params.startTime,
            params.totalPayments,
            params.paymentReference,
            params.cadence,
            params.subscriptionType
        );
        if (paymentAmount > params.paymentAmountMax) revert InvalidPaymentValue();

        spritzPay.delegatedPayWithToken(subscriber, params.paymentToken, paymentAmount, externalPaymentReference);

        emit PaymentProcessed(subscriber, subscriptionId);
    }

    /**
     * @notice Charges the given subscription and sends the payment to the SpritzPay contract
     * @param subscriber The account who owns the subscription
     * @param params The parameters for the subscription
     * @param swapParams The arguments for the swap payment
     * @param externalPaymentReference The reference passed on to delegated payment contract
     */
    function processSwapPayment(
        address subscriber,
        SubscriptionParams calldata params,
        SwapParams calldata swapParams,
        bytes32 externalPaymentReference
    ) external onlyRole(PAYMENT_PROCESSOR_ROLE) {
        if (params.subscriptionType != SubscriptionType.SWAP) revert InvalidSubscriptionType();

        bytes32 subscriptionId = _processSubscriptionCharge(
            subscriber,
            params.paymentToken,
            params.paymentAmountMax,
            params.startTime,
            params.totalPayments,
            params.paymentReference,
            params.cadence,
            params.subscriptionType
        );

        spritzPay.delegatedPayWithSwap(
            subscriber,
            params.paymentToken,
            swapParams.sourceTokenAmountMax,
            swapParams.paymentTokenAmount,
            externalPaymentReference,
            swapParams.deadline,
            swapParams.swapData
        );

        emit PaymentProcessed(subscriber, subscriptionId);
    }

    function _processSubscriptionCharge(
        address subscriber,
        address paymentToken,
        uint256 paymentAmountMax,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        SubscriptionType subscriptionType
    ) private returns (bytes32 subscriptionId) {
        subscriptionId = hashSubscription(
            subscriber,
            paymentToken,
            paymentAmountMax,
            startTime,
            totalPayments,
            paymentReference,
            cadence,
            subscriptionType
        );
        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.startTime == 0) revert SubscriptionNotFound(subscriptionId);

        bool canCharge = canChargeSubscription(
            totalPayments,
            subscription.paymentCount,
            subscription.startTime,
            cadence
        );
        if (!canCharge) revert InvalidPaymentCharge(subscriptionId, block.timestamp);

        subscription.lastPaymentTimestamp = block.timestamp;
        unchecked {
            subscription.paymentCount += 1;
        }
    }

    /**
     * @notice Allows subscriptions to be cleaned up by the processor bot
     * @param subscriptionId The ID of the subscription
     */
    function deleteSubscription(bytes32 subscriptionId) external onlyRole(PAYMENT_PROCESSOR_ROLE) {
        if (subscriptions[subscriptionId].startTime == 0) revert SubscriptionNotFound(subscriptionId);

        delete subscriptions[subscriptionId];

        emit SubscriptionDeleted(subscriptionId);
    }

    /**
     * @notice Creates a hash using the subscription data
     * @param subscriber The account who owns the subscription
     * @param paymentToken The address of the token used for payment
     * @param paymentAmount The amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     * @dev Allows subscription data to be stored off-chain, and validated on-chain
     * We include the chain id in the hash as this prevents collisions when deployed on multiple chains
     */
    function hashSubscription(
        address subscriber,
        address paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        SubscriptionType subscriptionType
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    subscriber,
                    paymentToken,
                    paymentAmount,
                    startTime,
                    totalPayments,
                    paymentReference,
                    cadence,
                    subscriptionType,
                    block.chainid
                )
            );
    }

    /**
     * @notice Checks whether a subscription can be charged
     * @dev Checks whether the appropriate number of intervals have passed
     * given the start date of the subscription, the frequency of charges,
     * and the total number of charges.
     * @param totalPayments The total payments the subscription is allowed to charge
     * @param paymentCount The current number of payments that have been processed on the subscription
     * @param startTime The start time of the first charge
     * @param cadence The frequency at which the subscription can be charged
     */
    function canChargeSubscription(
        uint256 totalPayments,
        uint256 paymentCount,
        uint256 startTime,
        SubscriptionCadence cadence
    ) private view returns (bool) {
        if (block.timestamp < startTime) return false;
        if (totalPayments > 0 && paymentCount == totalPayments) return false;

        if (cadence == SubscriptionCadence.MONTHLY) {
            return block.timestamp.validMonthsSince(startTime, paymentCount);
        } else if (cadence == SubscriptionCadence.WEEKLY) {
            return block.timestamp.validWeeksSince(startTime, paymentCount);
        } else if (cadence == SubscriptionCadence.DAILY) {
            return block.timestamp.validDaysSince(startTime, paymentCount);
        }

        return false;
    }

    /* ========== Admin Functionality ========== */

    function revokePaymentProcessor(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(PAYMENT_PROCESSOR_ROLE, processor);
    }

    function grantPaymentProcessor(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PAYMENT_PROCESSOR_ROLE, processor);
    }
}
