// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import { SpritzSmartPay } from "../../../contracts/SpritzSmartPay.sol";

contract SigUtils {
    bytes32 internal DOMAIN_SEPARATOR;

    constructor(bytes32 _DOMAIN_SEPARATOR) {
        DOMAIN_SEPARATOR = _DOMAIN_SEPARATOR;
    }

    // keccak256("Subscription(address paymentToken,uint256 paymentAmountMax,uint256 startTime,uint256 totalPayments,bytes32 paymentReference,uint8 cadence,uint8 subscriptionType)");
    bytes32 public constant SUBSCRIPTION_TYPEHASH = 0x68851eea381a7b03bd660cf3a16b5b96991bfcf7a8bca9c7fbb96a86822b831b;

    struct Subscription {
        address paymentToken;
        uint256 paymentAmountMax;
        uint256 startTime;
        uint256 totalPayments;
        bytes32 paymentReference;
        SpritzSmartPay.SubscriptionCadence cadence;
        SpritzSmartPay.SubscriptionType subscriptionType;
    }

    // computes the hash of a subscription
    function getStructHash(Subscription memory _subscription) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    SUBSCRIPTION_TYPEHASH,
                    _subscription.paymentToken,
                    _subscription.paymentAmountMax,
                    _subscription.startTime,
                    _subscription.totalPayments,
                    _subscription.paymentReference,
                    _subscription.cadence,
                    _subscription.subscriptionType
                )
            );
    }

    // computes the hash of the fully encoded EIP-712 message for the domain, which can be used to recover the signer
    function getTypedDataHash(Subscription memory _subscription) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, getStructHash(_subscription)));
    }
}
