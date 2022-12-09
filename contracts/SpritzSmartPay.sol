// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./lib/SubscriptionChargeDate.sol";

/**
 * @title SpritzSmartPay
 * @author Spritz Finance
 * @notice A contract for creating and processing recurring subscriptions. SpritzSmartPay acts as the manager of the
 * subscriptions, allows subscriptions to be created, validated and processed, but delegates the actual payment logic
 * to the SpritzPay contract.
 */
contract SpritzSmartPay is Context, EIP712, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using SubscriptionChargeDate for uint256;

    uint256 private constant MAX_UINT = 2 ** 256 - 1;

    bytes4 private constant SPRITZ_PAY_SELECTOR =
        bytes4(keccak256("payWithTokenSubscription(address,address,uint256,bytes32)"));

    bytes32 public constant SUBSCRIPTION_TYPEHASH =
        keccak256(
            "Subscription(address paymentToken,uint256 paymentAmount,uint256 startTime,uint256 totalPayments,bytes32 paymentReference,uint8 cadence)"
        );

    event SubscriptionCreated(
        address indexed subscriber,
        uint256 indexed subscriptionId,
        address indexed paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence
    );

    event PaymentProcessed(
        address indexed subscriber,
        uint256 indexed subscriptionId,
        address indexed paymentToken,
        uint256 paymentAmount,
        bytes32 paymentReference
    );

    event SubscriptionDeleted(address indexed subscriber, uint256 indexed subscriptionId);

    error ChargeSubscriptionFailed(address owner, bytes32 subscriptionId, uint256 amount);

    error InvalidPaymentCharge(uint256 subscriptionId, uint256 date);

    error UnauthorizedExecutor(address caller);

    error InvalidAddress();

    error SpritzPayPaymentFailure();

    error InvalidSubscription();

    error InvalidPaymentToken();

    error NotSubscriptionHolder(address caller);

    error SubscriptionAlreadyExists(uint256 subscriptionId);

    error SubscriptionNotFound(uint256 subscriptionId);

    error InvalidSignature();

    /// @notice The valid timings/cadence in which a subscription can be charged
    enum SubscriptionCadence {
        MONTHLY,
        WEEKLY,
        DAILY
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

    /// @notice The wallet owned by spritz that receives payments
    address internal immutable SPRITZ_PAY_ADDRESS;

    /// @notice The address of the stablecoin used to make payments
    address public immutable ACCEPTED_PAYMENT_TOKEN;

    /// @notice Mapping of the subscription id to the subscription on-chain data
    mapping(uint256 => Subscription) public subscriptions;

    constructor(address spritzPay, address paymentToken) EIP712("SpritzSmartPay", version()) {
        if (spritzPay == address(0)) revert InvalidAddress();
        SPRITZ_PAY_ADDRESS = spritzPay;
        ACCEPTED_PAYMENT_TOKEN = paymentToken;
    }

    function version() public pure returns (string memory) {
        return "1";
    }

    /**
     * @notice Create a subscription on behalf of a user using an EIP-712 signature
     * @param _subscriber The address of user who the subscription belongs to
     * @param paymentToken The address of the token used for payment
     * @param paymentAmount The amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     * @param signature The message signed by the user
     * @dev The bulk of the subscription data is emitted in the "SubscriptionCreated" event and will be stored off-chain.
     * This allows us to save significant gas by only storing critcal/variable data on-chain, and using a hash to validate the off-chain
     * data
     */
    function createSubscription(
        address _subscriber,
        address paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        Signature calldata signature
    ) external whenNotPaused {
        if (paymentAmount == 0 || startTime == 0) revert InvalidSubscription();
        if (paymentToken != ACCEPTED_PAYMENT_TOKEN) revert InvalidPaymentToken();

        address subscriber = ECDSA.recover(
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        SUBSCRIPTION_TYPEHASH,
                        paymentToken,
                        paymentAmount,
                        startTime,
                        totalPayments,
                        paymentReference,
                        cadence
                    )
                )
            ),
            signature.v,
            signature.r,
            signature.s
        );
        if (_subscriber != subscriber) revert InvalidSignature();

        uint256 subscriptionId = hashSubscription(
            subscriber,
            paymentToken,
            paymentAmount,
            startTime,
            totalPayments,
            paymentReference,
            cadence
        );

        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.startTime > 0) revert SubscriptionAlreadyExists(subscriptionId);

        subscription.startTime = startTime;

        emit SubscriptionCreated(
            subscriber,
            subscriptionId,
            paymentToken,
            paymentAmount,
            startTime,
            totalPayments,
            paymentReference,
            cadence
        );
    }

    /**
     * @notice Charges the given subscription and sends the payment to the SpritzPay contract
     * @param subscriber The account who owns the subscription
     * @param paymentToken The address of the token used for payment
     * @param paymentAmount The amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     */
    function processPayment(
        address subscriber,
        address paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence
    ) external whenNotPaused {
        uint256 subscriptionId = hashSubscription(
            subscriber,
            paymentToken,
            paymentAmount,
            startTime,
            totalPayments,
            paymentReference,
            cadence
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

        // pull funds from user
        IERC20 token = IERC20(paymentToken);
        token.safeTransferFrom(subscriber, address(this), paymentAmount);

        initiateSpritzPayPayment(subscriber, token, paymentAmount, paymentReference);

        emit PaymentProcessed(subscriber, subscriptionId, address(token), paymentAmount, paymentReference);
    }

    /**
     * @notice Allows a user to delete their subscription
     * @param subscriber The account who owns the subscription
     * @param paymentToken The address of the token used for payment
     * @param paymentAmount The amount the subscription is charged each time the subscription is processed
     * @param startTime The timestamp when the subscription should first be charged
     * @param totalPayments The total number of payments the subscription is allowed to process
     * @param paymentReference Arbitrary payment reference
     * @param cadence The frequency at which the subscription can be charged
     */
    function deleteSubscription(
        address subscriber,
        address paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence
    ) external {
        if (msg.sender != subscriber) revert NotSubscriptionHolder(msg.sender);

        uint256 subscriptionId = hashSubscription(
            subscriber,
            paymentToken,
            paymentAmount,
            startTime,
            totalPayments,
            paymentReference,
            cadence
        );
        if (subscriptions[subscriptionId].startTime == 0) revert SubscriptionNotFound(subscriptionId);

        delete subscriptions[subscriptionId];

        emit SubscriptionDeleted(subscriber, subscriptionId);
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
     */
    function hashSubscription(
        address subscriber,
        address paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence
    ) public pure returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encode(
                        subscriber,
                        paymentToken,
                        paymentAmount,
                        startTime,
                        totalPayments,
                        paymentReference,
                        cadence
                    )
                )
            );
    }

    /**
     * @notice Initiates a payment request to the SpritzPay contract on behalf of the subscriber
     * @param subscriber The account who the payment is being made on behalf of
     * @param paymentToken The token being used for payment
     * @param paymentAmount The amount of the token being transferred
     * @param paymentReference Arbitrary reference ID of the related payment
     */
    function initiateSpritzPayPayment(
        address subscriber,
        IERC20 paymentToken,
        uint256 paymentAmount,
        bytes32 paymentReference
    ) private {
        // Check that SpritzPay has spending allowance for the token
        uint256 allowance = paymentToken.allowance(address(this), SPRITZ_PAY_ADDRESS);
        if (allowance < paymentAmount) {
            paymentToken.safeIncreaseAllowance(SPRITZ_PAY_ADDRESS, MAX_UINT - allowance);
        }

        // call to the SpritzPay contract to issue payment event
        (bool success, bytes memory returndata) = SPRITZ_PAY_ADDRESS.call(
            abi.encodeWithSelector(
                SPRITZ_PAY_SELECTOR,
                subscriber,
                address(paymentToken),
                paymentAmount,
                paymentReference
            )
        );

        if (!success) {
            /// Look for the revert reason and return it if found
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert SpritzPayPaymentFailure();
            }
        }
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

    /**
     * @notice Allow the contract admin to pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Allow the contract admin to unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
