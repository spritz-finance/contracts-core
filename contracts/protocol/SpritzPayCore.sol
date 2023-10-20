// SPDX-License-Identifier: UNLICENSED

import "openzeppelin-5/utils/structs/EnumerableSet.sol";
import "openzeppelin-5/access/extensions/AccessControlEnumerable.sol";
import "openzeppelin-5/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-5/token/ERC20/IERC20.sol";

pragma solidity ^0.8.21;

/**
 * @title SpritzPayCore
 * @dev This contract acts as the core payment infrastructure for the Spritz protocol
 */
contract SpritzPayCore is AccessControlEnumerable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    /**
     * @notice Thrown when sweeping the contract fails
     */
    error FailedSweep();

    /**
     * @notice Thrown when paying with unrecognized token
     */
    error TokenNotAccepted(address token);

    /**
     * @dev Emitted when the payment recipient has been changed
     */
    event PaymentRecipientChanged(address recipient, address admin);

    /**
     * @dev Emitted when a payment has been successfully sent
     */
    event Payment(
        address to,
        address indexed from,
        address indexed sourceToken,
        uint256 sourceTokenAmount,
        address paymentToken,
        uint256 paymentTokenAmount,
        bytes32 indexed paymentReference
    );

    /// @notice List of all accepted payment tokens
    EnumerableSet.AddressSet internal _acceptedPaymentTokens;

    address public paymentRecipient;

    constructor(address admin) payable {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Core payment infrastructure - transfers tokens to payment recipient
     * and emits event to be processed offchain.
     * @dev requires that tokens be send to SpritzPayCore before calling the
     * pay method.
     * @param caller Address of the payment sender
     * @param paymentToken Address of the target payment token
     * @param paymentAmount Payment amount, denominated in target payment token
     * @param sourceToken Address of the original source token used for payment, as a reference
     * @param sourceTokenSpent The amount of the original source token
     * @param paymentReference Arbitrary reference ID of the related payment
     */
    function pay(
        address caller,
        address paymentToken,
        uint256 paymentAmount,
        address sourceToken,
        uint256 sourceTokenSpent,
        bytes32 paymentReference
    ) external {
        if (!_acceptedPaymentTokens.contains(paymentToken)) revert TokenNotAccepted(paymentToken);

        IERC20(paymentToken).safeTransfer(paymentRecipient, paymentAmount);

        emit Payment(
            paymentRecipient,
            caller,
            sourceToken,
            sourceTokenSpent,
            paymentToken,
            paymentAmount,
            paymentReference
        );
    }

    /**
     * @dev Get all accepted payment tokens
     * @return An array of the unique token addresses
     */
    function acceptedPaymentTokens() external view returns (address[] memory) {
        return _acceptedPaymentTokens.values();
    }

    /**
     * @dev Get all accepted payment tokens
     * @return Whether this payment token is accepted
     */
    function isAcceptedToken(address tokenAddress) external view returns (bool) {
        return _acceptedPaymentTokens.contains(tokenAddress);
    }

    /**
     * @dev Sets a new address for the payment recipient
     */
    function setPaymentRecipient(address newPaymentRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paymentRecipient = newPaymentRecipient;
        emit PaymentRecipientChanged(paymentRecipient, msg.sender);
    }

    /**
     * @dev Adds an accepted payment token
     */
    function addPaymentToken(address newToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _acceptedPaymentTokens.add(newToken);
    }

    /**
     * @dev Adds an accepted payment token
     */
    function removePaymentToken(address newToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _acceptedPaymentTokens.remove(newToken);
    }

    /**
     * @dev Withdraw deposited tokens to the given address
     * @param token Token to withdraw
     * @param to Target address
     */
    function sweep(IERC20 token, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        token.safeTransfer(to, token.balanceOf(address(this)));
    }

    /**
     * @dev Withdraw ETH to the given address
     * @param to Target address
     */
    function nativeSweep(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool success, ) = to.call{ value: address(this).balance }("");
        if (!success) revert FailedSweep();
    }

    receive() external payable {}
}
