// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../../contracts/SpritzPayV1.sol";

contract SpritzPayFuzzTest is SpritzPayV1 {
    address __owner = 0x1000000000000000000000000000000000000000;
    address _paymentRecipient = 0x2000000000000000000000000000000000000000;
    address _wethAddress = 0x3000000000000000000000000000000000000000;

    constructor() {
        initialize(_paymentRecipient, _wethAddress);
        transferOwnership(__owner);
    }

    function echidna_test_true() public view returns (bool) {
        return true;
    }

    function echidna_test_change_payment_recipient() public view returns (bool) {
        return paymentRecipient == _paymentRecipient;
    }

    function echidna_test_change_owner() public view returns (bool) {
        return owner() == __owner;
    }

    function echidna_test_change_weth_address() public view returns (bool) {
        return wethAddress == _wethAddress;
    }
}
