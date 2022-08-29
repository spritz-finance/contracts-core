// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./lib/SpritzPayStorage.sol";
import "./lib/WETHUpgradeable.sol";
import "./lib/SafeERC20.sol";

error FailedTokenTransfer(address tokenAddress, address to, uint256 amount);

/**
 * @title SpritzPayV1
 * @notice Main entry point for Spritz payments
 */
contract SpritzPayV1 is
    SpritzPayStorage,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    WETHUpgradeable
{
    using SafeERC20 for IERC20;

    /**
     * @dev Emitted when a payment has been sent
     */
    event Payment(
        address to,
        address indexed from,
        address indexed sourceToken,
        uint256 sourceTokenAmount,
        address paymentToken,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    );

    function initialize(address _paymentRecipient, address _wethAddress) public virtual initializer {
        _setPaymentRecipient(_paymentRecipient);
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __WETH_init(_wethAddress);
    }

    /**
     * @notice Pay by direct stablecoin transfer
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Payment amount, denominated in target payment token
     * @param paymentReference Reference of the related payment
     */
    function payWithToken(
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) external whenNotPaused {
        logPayment(paymentTokenAddress, paymentTokenAmount, paymentTokenAddress, paymentTokenAmount, paymentReference);

        bool transferSuccess = safeTransferToken(
            paymentTokenAddress,
            _msgSender(),
            paymentRecipient,
            paymentTokenAmount
        );
        if (!transferSuccess) {
            revert FailedTokenTransfer({
                tokenAddress: paymentTokenAddress,
                to: paymentRecipient,
                amount: paymentTokenAmount
            });
        }
    }

    function safeTransferToken(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool transferSuccess) {
        IERC20 erc20 = IERC20(token);
        transferSuccess = erc20.safeTransferFrom(from, to, amount);
    }

    function logPayment(
        address sourceTokenAddress,
        uint256 sourceTokenAmount,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        bytes32 paymentReference
    ) internal {
        emit Payment(
            paymentRecipient,
            _msgSender(),
            sourceTokenAddress,
            sourceTokenAmount,
            paymentTokenAddress,
            paymentTokenAmount,
            paymentReference
        );
    }

    /*
     * Admin functions to edit the admin, router address or weth address
     */

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPaymentRecipient(address newPaymentRecipient) external onlyOwner {
        _setPaymentRecipient(newPaymentRecipient);
    }

    function setWETHAddress(address newWETHAddress) external onlyOwner {
        if (newWETHAddress == address(0)) revert SetZeroAddress();
        _setWETHAddress(newWETHAddress);
    }
}
