// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./lib/SubscriptionChargeDate.sol";

contract SmartPay is Context, EIP712, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using SubscriptionChargeDate for uint256;

    uint256 private constant MAX_UINT = 2 ** 256 - 1;

    bytes4 private constant SPRITZ_PAY_SELECTOR =
        bytes4(keccak256("payWithTokenSubscription(address,address,uint256,bytes32)"));

    bytes32 public constant FIXED_SUBSCRIPTION_TYPEHASH =
        keccak256(
            "FixedSubscription(address paymentToken,uint256 paymentAmount,uint256 startTime,uint256 totalPayments,bytes32 paymentReference,SubscriptionCadence cadence)"
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
    error InvalidPaymentCharge(uint256 subscriptionId, uint256 date);

    /**
     * @notice Thrown when an unauthorised wallet tries to spend user funds
     * @param caller The wallet calling the guarded method
     */
    error UnauthorizedExecutor(address caller);

    /**
     * @notice Thrown when attempting to use an invalid
     */
    error InvalidAddress();

    error SpritzPayPaymentFailure();

    /**
     * @notice The valid timings/cadence in which a subscription can be charged
     */
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
     * @param totalPayments The total number of payments allowed on the subscription. 0 = unlimited
     * @param lastPaymentTimestamp The timestamp of the last payment
     */
    struct Subscription {
        uint256 paymentCount;
        uint256 startTime;
        uint256 totalPayments;
        uint256 lastPaymentTimestamp;
    }

    /// @notice The wallet owned by spritz that receives payments
    address internal immutable SPRITZ_PAY_ADDRESS;

    /// @notice Mapping of the subscription id to the subscription
    mapping(uint256 => Subscription) public subscriptions;

    constructor(address spritzPay) EIP712("SpritzSmartPay", version()) {
        if (spritzPay == address(0)) revert InvalidAddress();
        SPRITZ_PAY_ADDRESS = spritzPay;
    }

    function version() public pure returns (string memory) {
        return "1";
    }

    function createSubscription(
        address paymentToken,
        uint256 paymentAmount,
        uint256 startTime,
        uint256 totalPayments,
        bytes32 paymentReference,
        SubscriptionCadence cadence,
        Signature calldata signature
    ) public {
        if (paymentAmount == 0 || startTime == 0) revert(); //invalid

        address subscriber = ECDSA.recover(
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        FIXED_SUBSCRIPTION_TYPEHASH,
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
        if (subscription.startTime > 0) revert(); //exists

        subscription.startTime = startTime;
        subscription.totalPayments = totalPayments;

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
        if (subscription.startTime == 0) revert(); // does not exist

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
        uint256 allowance = paymentToken.allowance(address(this), SPRITZ_PAY_ADDRESS);
        if (allowance < paymentAmount) {
            paymentToken.safeIncreaseAllowance(SPRITZ_PAY_ADDRESS, MAX_UINT - allowance);
        }

        (bool success, bytes memory returndata) = SPRITZ_PAY_ADDRESS.call(
            abi.encodeWithSelector(SPRITZ_PAY_SELECTOR, subscriber, paymentToken, paymentAmount, paymentReference)
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
