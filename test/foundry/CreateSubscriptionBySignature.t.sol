// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import { SpritzSmartPay } from "../../contracts/SpritzSmartPay.sol";
import { SpritzSmartPayHarness } from "./harnesses/SpritzSmartPayHarness.sol";
import { SigUtils } from "./utils/SigUtils.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

// forge test --match-contract CreateSubscriptionBySignature
contract CreateSubscriptionBySignature is Test {
    uint256 internal subscriberPrivateKey;
    address internal subscriber;

    MockERC20 paymentToken;
    SpritzSmartPayHarness smartPay;
    SigUtils sigUtils;

    function setUp() public {
        smartPay = new SpritzSmartPayHarness();
        sigUtils = new SigUtils(smartPay.DOMAIN_SEPARATOR());
        paymentToken = new MockERC20("FakeCoin", "FAKE");
        subscriberPrivateKey = 0xA11CE;
        subscriber = vm.addr(subscriberPrivateKey);
    }

    function test_Permit() public {
        SigUtils.Subscription memory subscription = SigUtils.Subscription({
            paymentToken: address(paymentToken),
            paymentAmountMax: uint256(1000000),
            startTime: block.timestamp,
            totalPayments: 12,
            paymentReference: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,
            cadence: SpritzSmartPay.SubscriptionCadence.MONTHLY,
            subscriptionType: SpritzSmartPay.SubscriptionType.DIRECT
        });

        bytes32 digest = sigUtils.getTypedDataHash(subscription);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(subscriberPrivateKey, digest);

        smartPay.createSubscriptionBySignature(
            subscriber,
            subscription.paymentToken,
            subscription.paymentAmountMax,
            subscription.startTime,
            subscription.totalPayments,
            subscription.paymentReference,
            subscription.cadence,
            subscription.subscriptionType,
            SpritzSmartPay.Signature({ v: v, r: r, s: s })
        );

        bytes32 subscriptionId = smartPay.hashSubscription(
            subscriber,
            subscription.paymentToken,
            subscription.paymentAmountMax,
            subscription.startTime,
            subscription.totalPayments,
            subscription.paymentReference,
            subscription.cadence,
            subscription.subscriptionType
        );
        console.logBytes32(subscriptionId);
        (uint256 paymentCount, uint256 startTime, uint256 lastPaymentTimestamp) = smartPay.subscriptions(
            subscriptionId
        );
        assertEq(subscription.startTime, startTime);
        assertEq(lastPaymentTimestamp, 0);
        assertEq(paymentCount, 0);
        assertGt(startTime, 0);
    }
}
