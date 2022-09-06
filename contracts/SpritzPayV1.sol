// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./lib/SpritzPayStorage.sol";
import "./lib/WETHUpgradeable.sol";
import "./lib/SafeERC20.sol";

error FailedTokenTransfer(address tokenAddress, address to, uint256 amount);
error FailedSwap(
    address sourceTokenAddress,
    uint256 sourceTokenAmount,
    address paymentTokenAddress,
    uint256 paymentTokenAmount
);
error FailedRefund(address tokenAddress, uint256 amount);

/**
 * @title SpritzPayV1
 * @notice Main entry point for Spritz payments
 */
contract SpritzPayV1 is
    SpritzPayStorage,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    WETHUpgradeable,
    ReentrancyGuard
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

    function initialize(
        address _paymentRecipient,
        address _wethAddress,
        address _swapTarget
    ) public virtual initializer {
        _setPaymentRecipient(_paymentRecipient);
        _setSwapTarget(_swapTarget);
        __Ownable_init();
        __Pausable_init();
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

    /**
     * @notice Pay by swapping token or with native currency, using 0x as dex aggregator
     * @param sourceTokenAddress Address of the token being sold for payment
     * @param sourceTokenAmount Amount of the token being sold for payment
     * @param paymentTokenAddress Address of the target payment token
     * @param paymentTokenAmount Amount of the target payment token
     * @param allowanceTarget The `allowanceTarget` field from the 0x API response.
     * @param swapCallData The `data` field from the 0x API response.
     * @param paymentReference Reference of the payment related
     */
    function payWithSwap(
        address sourceTokenAddress,
        uint256 sourceTokenAmount,
        address paymentTokenAddress,
        uint256 paymentTokenAmount,
        address allowanceTarget,
        bytes calldata swapCallData,
        bytes32 paymentReference
    ) external payable whenNotPaused nonReentrant {
        bool isNativeSwap = allowanceTarget == address(0);
        IERC20 sourceToken = IERC20(sourceTokenAddress);

        // If swap involves non-native token
        if (!isNativeSwap) {
            //Ensure our contract gives sufficient allowance to swap target
            if (sourceToken.allowance(address(this), allowanceTarget) < sourceTokenAmount) {
                approveTokenSpend(sourceTokenAddress, allowanceTarget);
            }

            //Transfer from user to our contract
            bool transferInSuccess = safeTransferToken(
                sourceTokenAddress,
                _msgSender(),
                address(this),
                sourceTokenAmount
            );

            if (!transferInSuccess) {
                revert FailedTokenTransfer({
                    tokenAddress: sourceTokenAddress,
                    to: address(this),
                    amount: sourceTokenAmount
                });
            }
        }

        //Call 0x swap
        (bool swapSuccess, ) = swapTarget.call{ value: msg.value }(swapCallData);
        if (!swapSuccess) {
            revert FailedSwap({
                sourceTokenAddress: sourceTokenAddress,
                sourceTokenAmount: sourceTokenAmount,
                paymentTokenAddress: paymentTokenAddress,
                paymentTokenAmount: paymentTokenAmount
            });
        }

        //Transfer payment token to declared destination
        IERC20 paymentToken = IERC20(paymentTokenAddress);
        bool transferOutSuccess = paymentToken.transfer(paymentRecipient, paymentTokenAmount);
        if (!transferOutSuccess) {
            revert FailedTokenTransfer({
                tokenAddress: paymentTokenAddress,
                to: paymentRecipient,
                amount: paymentTokenAmount
            });
        }

        //Refund any remaining payment token balance to user
        {
            uint256 remainingPaymentTokenBalance = paymentToken.balanceOf(address(this));
            if (remainingPaymentTokenBalance > 0) {
                //Refund any remaining payment token to user
                bool refundPaymentTokenSuccess = paymentToken.transfer(_msgSender(), remainingPaymentTokenBalance);
                if (!refundPaymentTokenSuccess) {
                    revert FailedRefund({ tokenAddress: paymentTokenAddress, amount: remainingPaymentTokenBalance });
                }
            }
        }

        //Refund any remaining source token balance to user
        uint256 remainingBalance = 0;

        //Refund remaining source token to caller
        if (!isNativeSwap && sourceToken.balanceOf(address(this)) > 0) {
            remainingBalance = sourceToken.balanceOf(address(this));
            bool refundSourceTokenSuccess = sourceToken.transfer(msg.sender, remainingBalance);
            if (!refundSourceTokenSuccess) {
                revert FailedRefund({ tokenAddress: sourceTokenAddress, amount: remainingBalance });
            }
        }

        if (address(this).balance > 0) {
            if (isNativeSwap) {
                remainingBalance = address(this).balance;
            }
            (bool refundSuccess, ) = msg.sender.call{ value: address(this).balance }("");
            if (!refundSuccess) {
                revert FailedRefund({ tokenAddress: address(0), amount: remainingBalance });
            }
        }

        uint256 sourceTokenSpent = sourceTokenAmount - remainingBalance;

        logPayment(sourceTokenAddress, sourceTokenSpent, paymentTokenAddress, paymentTokenAmount, paymentReference);
    }

    /**
     * @notice Authorizes the swap router to spend a new payment currency (ERC20).
     * @param _erc20Address Address of an ERC20 used for payment
     */
    function approveTokenSpend(address _erc20Address, address allowanceTarget) private {
        IERC20 erc20 = IERC20(_erc20Address);
        uint256 max = 2**256 - 1;
        erc20.safeApprove(allowanceTarget, max);
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
