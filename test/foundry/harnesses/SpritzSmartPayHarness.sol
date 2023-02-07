// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { SpritzSmartPay } from "../../../contracts/SpritzSmartPay.sol";

contract SpritzSmartPayHarness is SpritzSmartPay {
    address internal _admin = address(1);
    address internal _spritzPay = address(2);
    address internal _paymentBot = address(3);

    constructor() {
        initialize(_admin, _spritzPay, _paymentBot);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
