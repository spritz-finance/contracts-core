// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

contract SpritzPayStorage is Initializable, AccessControlEnumerableUpgradeable {
    /**
     * @dev Emitted when the payment recipient has been changed
     */
    event PaymentRecipientChanged(address recipient, address sender);

    /**
     * @notice Thrown when setting one of our stored addresses to zero
     */
    error SetZeroAddress();

    address internal _paymentRecipient;
    address internal _swapTarget;
    address internal _wrappedNative;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @dev Initializes the contract
     */
    function __SpritzPayStorage_init(
        address newAdmin,
        address newPaymentRecipient,
        address newSwapTarget,
        address newWrappedNative
    ) internal onlyInitializing {
        _setupRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _setupRole(PAUSER_ROLE, newAdmin);
        _setPaymentRecipient(newPaymentRecipient);
        _setSwapTarget(newSwapTarget);
        _setWrappedNative(newWrappedNative);
    }

    /**
     * @dev Sets a new address for the payment recipient
     */
    function _setPaymentRecipient(address newPaymentRecipient) internal virtual {
        if (newPaymentRecipient == address(0)) revert SetZeroAddress();
        _paymentRecipient = newPaymentRecipient;
        emit PaymentRecipientChanged(_paymentRecipient, msg.sender);
    }

    /**
     * @dev Returns the address of the payment recipient
     */
    function paymentRecipient() public view virtual returns (address) {
        return _paymentRecipient;
    }

    /**
     * @dev Sets a new address for the swap target
     */
    function _setSwapTarget(address newSwapTarget) internal virtual {
        if (newSwapTarget == address(0)) revert SetZeroAddress();
        _swapTarget = newSwapTarget;
    }

    /**
     * @dev Returns the address of the swap target
     */
    function swapTarget() public view virtual returns (address) {
        return _swapTarget;
    }

    /**
     * @dev Sets a new address for the wrapped native token
     */
    function _setWrappedNative(address newWrappedNative) internal virtual {
        if (newWrappedNative == address(0)) revert SetZeroAddress();
        _wrappedNative = newWrappedNative;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[46] private __gap;
}
