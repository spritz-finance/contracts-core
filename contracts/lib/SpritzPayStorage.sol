// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

error SetZeroAddress();

contract SpritzPayStorage {
    /**
     * @dev Emitted when the payment recipient has been changed
     */
    event PaymentRecipientChanged(address recipient, address sender);

    address internal paymentRecipient;
    address internal swapTarget;
    address internal wrappedNative;

    /**
     * @dev Sets a new address for the payment recipient
     */
    function _setPaymentRecipient(address _paymentRecipient) internal virtual {
        if (_paymentRecipient == address(0)) revert SetZeroAddress();
        paymentRecipient = _paymentRecipient;
        emit PaymentRecipientChanged(_paymentRecipient, msg.sender);
    }

    /**
     * @dev Sets a new address for the swap target
     */
    function _setSwapTarget(address _swapTarget) internal virtual {
        if (_swapTarget == address(0)) revert SetZeroAddress();
        swapTarget = _swapTarget;
    }

    /**
     * @dev Sets Wrapped native currency adddress
     */
    function _setWrappedNative(address _wrappedNative) internal virtual {
        if (_wrappedNative == address(0)) revert SetZeroAddress();
        wrappedNative = _wrappedNative;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[47] private __gap;
}
