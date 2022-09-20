// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

import "../lib/SubscriptionChargeDate.sol";

contract TestDateValidation {
    using SubscriptionChargeDate for uint256;

    function monthlyValidation(
        uint256 startTime,
        uint256 currentTime,
        uint128 paymentAmount
    ) external pure returns (bool) {
        return currentTime.validMonthsSince(startTime, paymentAmount);
    }
}
